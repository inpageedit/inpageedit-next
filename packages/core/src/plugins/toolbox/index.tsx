import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit'
import { JSX, ReactElement } from 'jsx-dom'
import { defineAsyncComponent, type App as VueApp, type InjectionKey, type Ref } from 'vue'
import { shallowRef, ref, watchEffect } from 'vue'
import './styles.scss'
import { ComputeAbleSync } from '@/utils/computeable.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    toolbox: PluginToolbox
  }
  interface Events {
    'toolbox/button-added'(payload: { ctx: InPageEdit; payload: ToolboxButton }): void
    'toolbox/button-removed'(payload: { ctx: InPageEdit; payload: ToolboxButton }): void
    'toolbox/button-clicked'(payload: {
      ctx: InPageEdit
      event: MouseEvent
      payload: ToolboxButton
    }): void
    'toolbox/toggle'(payload: { ctx: InPageEdit; opened: boolean }): void
  }
  interface PreferencesMap {
    toolboxAlwaysShow: boolean
  }
}

export interface ToolboxButton {
  id: string
  group?: 'auto' | 'group1' | 'group2'
  icon: ComputeAbleSync<string | HTMLElement | SVGElement | ReactElement>
  tooltip?: ComputeAbleSync<string | HTMLElement>
  itemProps?: JSX.IntrinsicElements['li']
  buttonProps?: JSX.IntrinsicElements['button']
  onClick?: (event: MouseEvent) => void
  index?: number // 任意数值均可：负数靠前、正数靠后、Infinity 末尾、未传时按插入顺序
}

export interface ToolboxState {
  buttons: Ref<ToolboxButton[]>
  isPersistent: Ref<boolean>
  isHovered: Ref<boolean>
  compareButtons: (a: ToolboxButton, b: ToolboxButton) => number
  onToggle: () => void
  onButtonClick: (event: MouseEvent, button: ToolboxButton) => void
}

export const TOOLBOX_STATE_KEY: InjectionKey<ToolboxState> = Symbol('ToolboxState')

export function normalizeButtonId(id: string) {
  if (!id) {
    id = Math.random().toString(36).substring(2, 8)
  }
  return `ipe-toolbox__${id.trim()}`.replace(/[\s.#]+/g, '-')
}

@RegisterPreferences(
  Schema.object({
    toolboxAlwaysShow: Schema.boolean()
      .description('Make the toolbox opened by default')
      .default(false),
  }).description('Toolbox preferences')
)
@Inject(['preferences'])
export class PluginToolbox extends Service {
  container!: HTMLElement

  // ==== Vue app ====
  private _vueApp: VueApp | null = null
  private _stopClassWatcher: (() => void) | null = null

  // ==== Reactive state ====
  private _isPersistent = ref(false)
  private _isHovered = ref(false)
  private _buttons = shallowRef<ToolboxButton[]>([])

  // 插入顺序序列号：用于当 index 未给时保持"自然顺序"
  private seqCounter = 0
  private seqMap = new Map<string, number>() // id -> seq

  constructor(public ctx: InPageEdit) {
    super(ctx, 'toolbox', false)
  }

  protected async start(): Promise<void> {
    // Create container element
    this.container = document.createElement('div')
    this.container.id = 'ipe-edit-toolbox'
    document.body.appendChild(this.container)

    // Setup hover logic on container
    this.setupHoverLogic()

    // Sync reactive state to container CSS classes
    this._stopClassWatcher = watchEffect(() => {
      this.container.classList.toggle('is-persistent', this._isPersistent.value)
      this.container.classList.toggle('is-hovered', this._isHovered.value)
    })

    // Load persistent preference (async, non-blocking)
    this.ctx.preferences.get('toolboxAlwaysShow').then((val) => {
      if (val) {
        this._isPersistent.value = true
      }
    })

    // Create and mount Vue app
    const ToolboxApp = defineAsyncComponent(() => import('./components/ToolboxApp.vue'))
    this._vueApp = createVueAppWithIPE(this.ctx, ToolboxApp)
    this._vueApp.provide(TOOLBOX_STATE_KEY, this._createState())
    this._vueApp.mount(this.container)
  }

  protected stop(): void {
    this._stopClassWatcher?.()
    this._stopClassWatcher = null
    this._vueApp?.unmount()
    this._vueApp = null
    this.container?.remove()
  }

  private _createState(): ToolboxState {
    return {
      buttons: this._buttons,
      isPersistent: this._isPersistent,
      isHovered: this._isHovered,
      compareButtons: this.compareButtons,
      onToggle: () => this.toggle(),
      onButtonClick: (event: MouseEvent, button: ToolboxButton) => {
        this.ctx.emit('toolbox/button-clicked', {
          ctx: this.ctx,
          event,
          payload: button,
        })
      },
    }
  }

  private setupHoverLogic() {
    let hoverTimeout: number | null = null

    // 鼠标进入时暂时展开
    this.container.addEventListener('mouseenter', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
        hoverTimeout = null
      }

      // 如果不在持久化状态，则添加hover展开效果
      if (!this._isPersistent.value) {
        this._isHovered.value = true
      }
    })

    // 鼠标离开时收起（如果不是持久化状态）
    this.container.addEventListener('mouseleave', () => {
      if (!this._isPersistent.value) {
        hoverTimeout = window.setTimeout(() => {
          this._isHovered.value = false
        }, 150) // 延迟150ms收起，避免快速移动鼠标时闪烁
      }
    })
  }

  // ====== 排序与分组 ======
  private chooseAutoGroup(): 'group1' | 'group2' {
    const buttons = this._buttons.value
    const g1 = buttons.filter((b) => b.group === 'group1').length
    const g2 = buttons.filter((b) => b.group === 'group2').length
    return g1 <= g2 ? 'group1' : 'group2'
  }

  private orderKey(btn: ToolboxButton): number | null {
    const idx = (btn as any).index
    if (typeof idx === 'number') {
      if (Number.isNaN(idx)) return null
      return idx
    }
    return null
  }

  compareButtons = (a: ToolboxButton, b: ToolboxButton) => {
    const ak = this.orderKey(a)
    const bk = this.orderKey(b)

    const va = ak ?? 0
    const vb = bk ?? 0

    if (va < vb) return -1
    if (va > vb) return 1

    const sa = this.seqMap.get(a.id) ?? 0
    const sb = this.seqMap.get(b.id) ?? 0

    if (ak === null && bk === null) {
      if (sa !== sb) return sa - sb
      return 0
    }

    if (ak === null && bk !== null) return -1
    if (ak !== null && bk === null) return 1

    if (sa !== sb) return sa - sb
    return 0
  }

  // ====== 对外 API：新增/替换/删除 ======
  addButton(payload: ToolboxButton) {
    payload.id = (payload.id || '').trim()
    if (!payload.id) {
      this.ctx.logger('toolbox').warn('Button id is empty, generating a random one.')
      payload.id = Math.random().toString(36).slice(2, 10)
    }

    const buttons = this._buttons.value
    const existingIndex = buttons.findIndex((button) => button.id === payload.id)

    const nextGroup: 'group1' | 'group2' = (() => {
      if (existingIndex !== -1) {
        const old = buttons[existingIndex]
        return !payload.group || payload.group === 'auto' ? (old.group as any) : payload.group
      }
      return !payload.group || payload.group === 'auto' ? this.chooseAutoGroup() : payload.group
    })()

    if (!this.seqMap.has(payload.id)) {
      this.seqMap.set(payload.id, this.seqCounter++)
    }

    const newButtons = [...buttons]

    if (existingIndex !== -1) {
      const old = buttons[existingIndex]
      const incomingIndex =
        typeof payload.index === 'number' && !Number.isNaN(payload.index)
          ? payload.index
          : old.index
      const merged: ToolboxButton = { ...old, ...payload, group: nextGroup, index: incomingIndex }
      newButtons.splice(existingIndex, 1, merged)
    } else {
      const incomingIndex =
        typeof payload.index === 'number' && !Number.isNaN(payload.index)
          ? payload.index
          : undefined
      const fresh: ToolboxButton = { ...payload, group: nextGroup, index: incomingIndex }
      newButtons.push(fresh)
    }

    this._buttons.value = newButtons
    this.ctx.emit('toolbox/button-added', { ctx: this.ctx, payload })
  }

  removeButton(id: string) {
    const buttons = this._buttons.value
    const index = buttons.findIndex((button) => button.id === id)
    if (index !== -1) {
      const payload = buttons[index]
      const newButtons = [...buttons]
      newButtons.splice(index, 1)
      this._buttons.value = newButtons
      this.ctx.emit('toolbox/button-removed', { ctx: this.ctx, payload })
    }
  }

  getContainer() {
    return this.container
  }

  get isOpened() {
    return this._isPersistent.value || this._isHovered.value
  }

  toggle(force?: boolean) {
    const newPersistent = typeof force === 'boolean' ? force : !this._isPersistent.value
    this._isPersistent.value = newPersistent
    this._isHovered.value = false
    this.ctx.preferences.set('toolboxAlwaysShow', newPersistent)
    this.ctx.emit('toolbox/toggle', { ctx: this.ctx, opened: this.isOpened })
  }
}
