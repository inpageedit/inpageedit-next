export class MemoryStorage implements Storage {
  private values: Record<string, string> = {}
  get length(): number {
    return Object.keys(this.values).length
  }
  clear(): void {
    this.values = {}
  }
  getItem(key: string): string | null {
    return this.values[key] ?? null
  }
  setItem(key: string, value: string): void {
    this.values[key] = typeof value === 'string' ? value : String(value)
  }
  removeItem(key: string): void {
    delete this.values[key]
  }
  key(index: number): string | null {
    const keys = Object.keys(this.values)
    return keys[index] ?? null
  }
}
export const useMemoryStorage = () => {
  // handle storage.foo = 'bar' case
  return new Proxy(new MemoryStorage(), {
    set(target, prop, value) {
      if (typeof prop === 'string') {
        target.setItem(prop, value)
      }
      return true
    },
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target)) {
        return target.getItem(prop)
      }
      return Reflect.get(target, prop)
    },
  })
}
