import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/InPageEdit', () => {
  const makeChain = () => ({
    description() {
      return this
    },
    extra() {
      return this
    },
    default() {
      return this
    },
  })

  return {
    Inject: () => () => undefined,
    Schema: {
      const: () => makeChain(),
      union: () => makeChain(),
      object: () => makeChain(),
    },
    Service: class {
      constructor(public ctx: any) {}
    },
  }
})

vi.mock('@/decorators/Preferences', () => ({
  RegisterPreferences: () => () => undefined,
}))

const { ThemeService } = await import('./ThemeService')

const createMockBody = (initialClasses: string[] = []) => {
  const classes = new Set(initialClasses)
  return {
    classList: {
      contains: (name: string) => classes.has(name),
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
    setAttribute: vi.fn(),
  }
}

describe('ThemeService', () => {
  beforeEach(() => {
    ;(globalThis as any).document = {
      body: createMockBody(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('avoids repeated emit when derived theme is unchanged', async () => {
    ;(globalThis as any).document.body = createMockBody([
      'theme-fandomdesktop-dark',
    ])

    const emit = vi.fn()
    const service = new ThemeService({
      preferences: { get: vi.fn().mockResolvedValue('fandom') },
      emit,
    } as any)
    ;(service as any)._observer = { observe: vi.fn(), disconnect: vi.fn() }

    await service.applyTheme()
    await service.applyTheme()

    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('ignores fandom body class mutations that do not change effective theme', async () => {
    ;(globalThis as any).document.body = createMockBody([
      'theme-fandomdesktop-dark',
    ])

    const service = new ThemeService({
      preferences: { get: vi.fn().mockResolvedValue('fandom') },
      emit: vi.fn(),
    } as any)
    ;(service as any)._observer = { observe: vi.fn(), disconnect: vi.fn() }

    await service.applyTheme()
    const applyThemeSpy = vi.spyOn(service, 'applyTheme')
    await (service as any)._onBodyClassChange()

    expect(applyThemeSpy).not.toHaveBeenCalled()
  })

  it('registers fandom observer only once while preference remains fandom', async () => {
    const observe = vi.fn()
    const service = new ThemeService({
      preferences: { get: vi.fn().mockResolvedValue('fandom') },
      emit: vi.fn(),
    } as any)
    ;(service as any)._observer = { observe, disconnect: vi.fn() }

    await service.applyTheme()
    await service.applyTheme()

    expect(observe).toHaveBeenCalledTimes(1)
  })
})
