import './style.scss'

/* --------------------------------------------------------------------------
 * IPEModal
 * --------------------------------------------------------------------------
 * - No jQuery dependencies
 * - DOM-only API
 * - Basic a11y (aria-modal, role, focus trap, ESC to close)
 * - CSS-driven animations via classes + variables
 * - Simple plugin-style helpers: dialog, confirm, notify
 * -------------------------------------------------------------------------- */

export type SsiModalSizeClass =
  | 'dialog'
  | 'small'
  | 'smallToMedium'
  | 'medium'
  | 'mediumToLarge'
  | 'large'
  | 'full'
  | 'auto'

export type IPEModalAnimation =
  | string
  | {
      show?: string | false
      hide?: string | false
    }
  | false

export type AnyContent = string | Node

export interface IPEModalButtonOptions {
  label: AnyContent
  type?: 'button' | 'link'
  className?: string
  enableAfter?: number | false
  id?: string
  method?: (this: HTMLButtonElement | HTMLAnchorElement, event: MouseEvent, modal: IPEModal) => void
  side?: 'left' | 'right'
  keyPress?: string // e.g. 'Enter' | 'Escape' | 'y' | 'n'
  closeAfter?: number | false
  href?: string // for type:'link'
}

export interface IPEModalOptions {
  // visual
  className?: string
  sizeClass?: SsiModalSizeClass
  center?: boolean
  fixedHeight?: boolean | number
  fitScreen?: boolean
  iconButtons?: boolean
  closeIcon?: boolean

  // content
  title?: AnyContent
  content?: AnyContent
  buttons?: Partial<IPEModalButtonOptions>[]

  // behavior
  backdrop?: boolean | 'shared' | 'byKindShared'
  outSideClose?: boolean
  bodyScroll?: boolean // disable body scroll while open (default true)
  stack?: boolean
  navigation?: boolean

  // timing
  animation?: IPEModalAnimation
  modalAnimation?: IPEModalAnimation
  backdropAnimation?: IPEModalAnimation
  animationSpeed?: number // ms
  closeAfter?: {
    time: number
    displayTime?: number
    resetOnHover?: boolean
  }

  // positioning (kept for parity; css controls actual layout)
  position?:
    | 'right top'
    | 'right bottom'
    | 'left top'
    | 'left bottom'
    | 'center top'
    | 'center bottom'

  // callbacks
  beforeShow?: (modal: IPEModal) => boolean | void
  onShow?: (modal: IPEModal) => void
  beforeClose?: (modal: IPEModal) => boolean | void
  onClose?: (modal: IPEModal) => void
  onClickClose?: boolean | ((modal: IPEModal) => void)
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export enum IPEModalEvent {
  Init = 'modal.init',
  BeforeShow = 'modal.beforeShow',
  Show = 'modal.show',
  BeforeClose = 'modal.beforeClose',
  Close = 'modal.close',
  Destroy = 'modal.destroy',
  ToastShow = 'toast.show',
  ToastClose = 'toast.close',
}

export type IPEModalHook = (ev: CustomEvent<IPEModal>) => boolean | void

declare global {
  interface HTMLElementEventMap {
    'modal.init': CustomEvent<IPEModal>
    'modal.beforeShow': CustomEvent<IPEModal>
    'modal.show': CustomEvent<IPEModal>
    'modal.beforeClose': CustomEvent<IPEModal>
    'modal.close': CustomEvent<IPEModal>
    'modal.destroy': CustomEvent<IPEModal>
    'toast.show': CustomEvent<IPEModal>
    'toast.close': CustomEvent<IPEModal>
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
let uid = 0
const nextId = (prefix: string) => `${prefix}-${++uid}`

function toNode(v: AnyContent): Node {
  // 已是任意 Node（包含 HTMLElement、Text、DocumentFragment 等）
  if (v instanceof Node) return v
  // 字符串按 textContent 处理，避免作为 HTML 解析
  return document.createTextNode(String(v))
}

function assertEl<T extends HTMLElement>(el: T | null, name: string): T {
  if (!el) throw new Error(`${name} not found`)
  return el
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  const sel = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(
    (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
  )
}

// Simple stack manager
class ModalStackManager {
  zBase = 1000
  stack: IPEModal[] = []

  push(modal: IPEModal) {
    this.stack.push(modal)
    this.syncZ()
  }
  remove(modal: IPEModal) {
    this.stack = this.stack.filter((m) => m !== modal)
    this.syncZ()
  }
  top(): IPEModal | undefined {
    return this.stack[this.stack.length - 1]
  }
  closeAll(group?: string | string[], except?: string | string[]) {
    const exceptSet = new Set((Array.isArray(except) ? except : except ? [except] : []).map(String))
    const groupSet = new Set((Array.isArray(group) ? group : group ? [group] : []).map(String))
    // close from top to bottom to respect stacking
    ;[...this.stack].reverse().forEach((m) => {
      const id = m.modalId
      const belongs = groupSet.size ? groupSet.has(m.pluginName) : true
      const excluded = exceptSet.has(id)
      if (belongs && !excluded) m.close()
    })
  }
  removeAll() {
    ;[...this.stack].forEach((m) => m.destroy())
    this.stack = []
  }
  private syncZ() {
    this.stack.forEach((m, i) => m.setZIndex(this.zBase + i * 2))
  }
}
const STACK = new ModalStackManager()

// ---------------------------------------------------------------------------
// IPEModal class (DOM-only)
// ---------------------------------------------------------------------------
export class IPEModal {
  // public ids
  readonly backdropId = nextId('ipe-backdrop')
  readonly modalId = nextId('ipe-modal')
  readonly numberId = this.modalId.replace('ipe-modal-', '')

  // options
  options: IPEModalOptions
  readonly pluginName = 'normalModal'

  // elements
  private $backdrop?: HTMLDivElement
  private $modal?: HTMLDivElement & { modal: IPEModal } // outer container inside backdrop
  private $window?: HTMLDivElement & { modal: IPEModal } // actual "window"
  private $header?: HTMLDivElement
  private $title?: HTMLHeadingElement
  private $icons?: HTMLDivElement
  private $content?: HTMLDivElement
  private $footer?: HTMLDivElement
  private $buttonsLeft?: HTMLDivElement
  private $buttonsRight?: HTMLDivElement
  // maintain current button elements by side for indexing and updates
  private buttonElsLeft: (HTMLButtonElement | HTMLAnchorElement)[] = []
  private buttonElsRight: (HTMLButtonElement | HTMLAnchorElement)[] = []

  // state
  private isOpen = false
  private lastFocused?: HTMLElement | null
  private closeTimer?: number
  private isToast = false

  // public helpers
  Event = IPEModalEvent

  constructor(options: Partial<IPEModalOptions> = {}) {
    this.options = {
      className: '',
      sizeClass: 'auto',
      center: true,
      fitScreen: false,
      closeIcon: true,
      bodyScroll: true,
      outSideClose: true,
      backdrop: true,
      // 默认无过渡动画
      animation: false,
      animationSpeed: 200,
      ...options,
    }
  }

  // ------------------------------ lifecycle ------------------------------ //
  init(): this {
    if (this.$backdrop) return this

    // Backdrop
    const $backdrop = document.createElement('div')
    $backdrop.id = this.backdropId
    $backdrop.className = `ipe-backdrop`
    $backdrop.setAttribute('data-modal-id', this.modalId)
    // 如果 backdrop 为 false，添加 no-backdrop 类来隐藏背景
    if (this.options.backdrop === false) {
      $backdrop.classList.add('no-backdrop')
    }

    // Modal (outer)
    const $modal = document.createElement('div') as HTMLDivElement & { modal: IPEModal }
    $modal.id = this.modalId
    $modal.className = 'ipe-modal'
    $modal.role = 'dialog'
    $modal.ariaModal = 'true'
    $modal.modal = this

    // Window
    const $window = document.createElement('div') as HTMLDivElement & { modal: IPEModal }
    $window.className = `ipe-modal__window size--${this.options.sizeClass}`
    $window.modal = this

    // Header
    const $header = document.createElement('div')
    $header.className = 'ipe-modal__header'

    const $title = document.createElement('div')
    $title.className = 'ipe-modal__title'
    $title.role = 'heading'

    const $icons = document.createElement('div')
    $icons.className = 'ipe-modal__icons'

    if (this.options.closeIcon) {
      const closeBtn = document.createElement('button')
      closeBtn.className = 'ipe-modal__close'
      closeBtn.type = 'button'
      closeBtn.setAttribute('aria-label', 'Close')
      closeBtn.innerHTML = '&times;'
      closeBtn.addEventListener('click', () => {
        if (typeof this.options.onClickClose === 'function') {
          this.options.onClickClose(this)
        }
        this.close()
      })
      // 默认将关闭按钮作为 icons 区的一员
      $icons.appendChild(closeBtn)
    }

    $header.append($title, $icons)

    // Content
    const $content = document.createElement('div')
    $content.className = 'ipe-modal__content'

    // Footer (buttons)
    const $footer = document.createElement('div')
    $footer.className = 'ipe-modal__footer'

    const $btnsLeft = document.createElement('div')
    $btnsLeft.className = 'ipe-modal__buttons ipe-modal__buttons--left'

    const $btnsRight = document.createElement('div')
    $btnsRight.className = 'ipe-modal__buttons ipe-modal__buttons--right'

    $footer.append($btnsLeft, $btnsRight)

    $window.append($header, $content, $footer)
    $modal.appendChild($window)
    $backdrop.appendChild($modal)

    // store refs
    this.$backdrop = $backdrop
    this.$modal = $modal
    this.$window = $window
    this.$header = $header
    this.$title = $title
    this.$icons = $icons
    this.$content = $content
    this.$footer = $footer
    this.$buttonsLeft = $btnsLeft
    this.$buttonsRight = $btnsRight

    // content + title + buttons
    if (this.options.title) this.setTitle(this.options.title)
    if (this.options.content) this.setContent(this.options.content)
    if (this.options.buttons?.length) {
      this.setButtons(this.options.buttons)
    } else {
      // 如果没有 buttons，隐藏 footer
      $footer.style.display = 'none'
    }

    // position helpers
    if (this.options.center) this.$modal.classList.add('is-centered')
    if (this.options.fitScreen) this.$modal.classList.add('is-fullscreen')
    if (this.options.className) this.$window.classList.add(...this.options.className.split(' '))

    // interactions
    $backdrop.addEventListener('mousedown', (e) => {
      if (!this.options.outSideClose) return
      // 点击 backdrop 或 modal 容器（但不在 window 内）时关闭
      if (e.target === $backdrop || !(e.target as HTMLElement)?.closest?.('.ipe-modal__window')) {
        this.close()
      }
    })

    // keyboard
    this.onKeyDown = this.onKeyDown.bind(this)

    // lifecycle event: init
    this.emit(IPEModalEvent.Init)
    return this
  }

  show(): this {
    if (!this.$backdrop) this.init()
    if (!this.$backdrop || !this.$modal) return this

    // beforeShow lifecycle (cancelable)
    {
      const allowedByEvent = this.emit(IPEModalEvent.BeforeShow, true)
      const allowedByHook = this.options.beforeShow ? this.options.beforeShow(this) !== false : true
      if (!allowedByEvent || !allowedByHook) {
        return this
      }
    }

    // save focus & trap
    this.lastFocused = (document.activeElement as HTMLElement) ?? null

    document.body.appendChild(this.$backdrop)

    if (this.options.bodyScroll === false) {
      document.documentElement.classList.add('ipe-no-scroll')
    }

    requestAnimationFrame(() => {
      this.$backdrop!.classList.add('is-open')
      this.$modal!.classList.add('is-open')
      this.applyAnimation(true)
      this.focusFirst()
    })

    document.addEventListener('keydown', this.onKeyDown)
    STACK.push(this)

    this.isOpen = true
    this.options.onShow?.(this)
    // lifecycle: shown
    this.emit(IPEModalEvent.Show)

    // auto close
    if (this.options.closeAfter?.time) {
      this.startCloseTimer(this.options.closeAfter.time)
      if (this.options.closeAfter.resetOnHover) {
        this.$window?.addEventListener('mouseenter', this.stopCloseTimer)
        this.$window?.addEventListener('mouseleave', () =>
          this.startCloseTimer(this.options!.closeAfter!.time)
        )
      }
    }

    return this
  }

  close(): this {
    if (!this.isOpen) return this
    // beforeClose lifecycle (cancelable)
    {
      const allowedByEvent = this.emit(IPEModalEvent.BeforeClose, true)
      const allowedByHook = this.options.beforeClose
        ? this.options.beforeClose(this) !== false
        : true
      if (!allowedByEvent || !allowedByHook) {
        return this
      }
    }

    // Toast 模式直接销毁，不走过渡
    if (this.isToast) {
      this.emit(IPEModalEvent.Close)
      this.emit(IPEModalEvent.ToastClose)
      this.destroy()
      this.options.onClose?.(this)
      return this
    }

    this.applyAnimation(false)

    this.$backdrop?.classList.remove('is-open')
    this.$modal?.classList.remove('is-open')

    // lifecycle: close (modal)
    this.emit(IPEModalEvent.Close)
    // wait for CSS transition end, then destroy DOM
    const duration = this.isAnimationDisabled() ? 0 : (this.options.animationSpeed ?? 200)
    window.setTimeout(() => {
      this.destroy()
      this.options.onClose?.(this)
    }, duration)
    return this
  }

  /** Immediately removes DOM and listeners */
  destroy(): this {
    this.stopCloseTimer()
    document.removeEventListener('keydown', this.onKeyDown)

    this.$window?.removeEventListener('mouseenter', this.stopCloseTimer)

    if (this.isToast) {
      // Toast: 仅移除窗口节点
      if (this.$window?.parentElement) this.$window.parentElement.removeChild(this.$window)
    } else {
      if (this.$backdrop?.parentElement) this.$backdrop.parentElement.removeChild(this.$backdrop)
    }

    if (this.options.bodyScroll === false) {
      // only enable scroll if no modals remain
      if (!STACK.top() || STACK.top() === this) {
        document.documentElement.classList.remove('ipe-no-scroll')
      }
    }

    STACK.remove(this)
    this.isOpen = false

    // restore focus
    this.lastFocused?.focus?.()
    // lifecycle: destroy
    this.emit(IPEModalEvent.Destroy)
    return this
  }

  // ------------------------------ getters ------------------------------- //
  get$backdrop(): HTMLDivElement {
    return assertEl(this.$backdrop!, 'backdrop')
  }
  get$modal(): HTMLDivElement {
    return assertEl(this.$modal!, 'modal')
  }
  get$window(): HTMLDivElement {
    return assertEl(this.$window!, 'window')
  }
  get$header(): HTMLDivElement {
    return assertEl(this.$header!, 'header')
  }
  get$title(): HTMLHeadingElement {
    return assertEl(this.$title!, 'title')
  }
  get$content(): HTMLDivElement {
    return assertEl(this.$content!, 'content')
  }
  get$icons(): HTMLDivElement {
    return assertEl(this.$icons!, 'icons')
  }
  get$buttons(type?: 'buttons' | 'leftButtons' | 'rightButtons') {
    if (type === 'leftButtons') return assertEl(this.$buttonsLeft!, 'leftButtons')
    if (type === 'rightButtons') return assertEl(this.$buttonsRight!, 'rightButtons')
    return assertEl(this.$footer!, 'buttons')
  }

  // ------------------------------ content ------------------------------- //
  setTitle(title: AnyContent): this {
    const el = this.get$title()
    el.innerHTML = ''
    el.append(toNode(title))
    return this
  }

  setContent(content: AnyContent, method: 'replace' | 'append' | 'prepend' = 'replace'): this {
    const el = this.get$content()
    if (method === 'replace') {
      el.innerHTML = ''
      el.append(toNode(content))
    } else if (method === 'append') {
      el.append(toNode(content))
    } else {
      el.prepend(toNode(content))
    }
    return this
  }

  setIcons(icons: { className: string; method: () => void }[]): this {
    const wrap = this.get$icons()
    wrap.innerHTML = ''
    for (const ic of icons) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `ipe-modal__icon ${ic.className}`
      btn.addEventListener('click', ic.method)
      wrap.appendChild(btn)
    }
    return this
  }

  setButtons(buttons: Partial<IPEModalButtonOptions>[], area?: HTMLElement): this {
    const left = this.$buttonsLeft!
    const right = this.$buttonsRight!
    ;[left, right].forEach((c) => (c.innerHTML = ''))
    // reset state when managing footer buttons
    this.buttonElsLeft = []
    this.buttonElsRight = []

    const target = area ?? this.$footer!

    if (target === this.$footer) {
      // 使用 footer：复用 addButton 方法
      buttons.forEach((b) => this.addButton(b))
      if (buttons.length === 0) {
        this.$footer.style.display = 'none'
      }
    } else {
      // 自定义区域：独立处理
      target.innerHTML = ''
      for (const b of buttons) {
        const el = this.generateButton(b)
        const side = b.side ?? 'right'
        const container = side === 'left' ? left : right
        container.appendChild(el)
      }
    }

    return this
  }

  generateButton(opts: Partial<IPEModalButtonOptions>): HTMLButtonElement | HTMLAnchorElement {
    const type = opts.type ?? 'button'
    const base = type === 'link' ? document.createElement('a') : document.createElement('button')
    if (type === 'button') (base as HTMLButtonElement).type = 'button'

    if (opts.id) base.id = opts.id
    base.className = `ipe-btn ${opts.className ?? ''}`.trim()

    const labelNode = toNode(opts.label ?? 'OK')
    base.append(labelNode)

    if (type === 'link' && opts.href) (base as HTMLAnchorElement).href = opts.href

    if (opts.method) {
      base.addEventListener('click', (e) => opts.method!.call(base as any, e as MouseEvent, this))
    }

    if (opts.closeAfter && typeof opts.closeAfter === 'number') {
      base.addEventListener('click', () => {
        window.setTimeout(() => this.close(), opts.closeAfter as number)
      })
    }

    if (opts.enableAfter && typeof opts.enableAfter === 'number') {
      base.setAttribute('disabled', 'true')
      window.setTimeout(() => base.removeAttribute('disabled'), opts.enableAfter)
    }

    if (opts.keyPress) {
      // handled in onKeyDown
      ;(base as any)._ipe_key = opts.keyPress
    }

    return base
  }

  /**
   * 动态添加按钮至 footer，支持 index（在该 side 容器中的插入位置）
   */
  addButton(opts: Partial<IPEModalButtonOptions>, index?: number): this {
    // 添加按钮时，确保 footer 可见
    if (this.$footer) {
      this.$footer.style.display = ''
    }

    const side = opts.side ?? 'right'
    const container = side === 'left' ? this.$buttonsLeft! : this.$buttonsRight!
    const list = side === 'left' ? this.buttonElsLeft : this.buttonElsRight
    const el = this.generateButton(opts)

    const insertAt = Math.max(0, Math.min(index ?? list.length, list.length))
    if (insertAt >= container.children.length) {
      container.appendChild(el)
    } else {
      container.insertBefore(el, container.children[insertAt])
    }
    list.splice(insertAt, 0, el)
    return this
  }

  /**
   * 按元素/ID/全局索引移除按钮
   * - 索引按当前 footer 按钮的顺序（先 left 后 right）
   */
  removeButton(target: number | string | HTMLElement): this {
    const left = this.buttonElsLeft
    const right = this.buttonElsRight
    const combined = [...left, ...right]

    let el: HTMLElement | null = null
    if (typeof target === 'number') {
      el = combined[target] ?? null
    } else if (typeof target === 'string') {
      el = combined.find((e) => e.id === target) ?? null
    } else if (target instanceof HTMLElement) {
      el = combined.find((e) => e === target) ?? null
    }

    if (!el) return this

    // 从对应 side 的列表中删除
    let idx = left.indexOf(el as any)
    if (idx !== -1) {
      left.splice(idx, 1)
      el.parentElement?.removeChild(el)
    } else {
      idx = right.indexOf(el as any)
      if (idx !== -1) {
        right.splice(idx, 1)
        el.parentElement?.removeChild(el)
      }
    }

    // 如果所有按钮都被移除，隐藏 footer
    if (left.length === 0 && right.length === 0 && this.$footer) {
      this.$footer.style.display = 'none'
    }

    return this
  }

  changePreviewState(): this {
    this.get$modal().classList.toggle('is-fullscreen')
    return this
  }

  setModalHeight(
    offset: number,
    option: 'height' | 'min-height' | 'max-height' = 'height'
  ): number {
    const win = this.get$window()
    const h = Math.max(0, window.innerHeight - offset)
    ;(win.style as any)[option] = `${h}px`
    return h
  }

  setOptions<T extends keyof IPEModalOptions>(option: T, value: IPEModalOptions[T]): this
  setOptions(options: Partial<IPEModalOptions>): this
  setOptions(a: any, b?: any): this {
    if (typeof a === 'string') {
      ;(this.options as any)[a] = b
    } else {
      Object.assign(this.options, a)
    }
    return this
  }

  setPluginName(name: string): this {
    ;(this as any).pluginName = name
    return this
  }

  // ------------------------------ helpers ------------------------------- //
  private applyAnimation(show: boolean) {
    const modal = this.get$modal()
    const win = this.get$window()
    const backdrop = this.get$backdrop()
    const anim = this.options.modalAnimation ?? this.options.animation
    const name = typeof anim === 'string' ? anim : anim && (show ? anim.show : anim.hide)
    if (!name || (name as any) === false) {
      // 彻底禁用动画/过渡
      modal.style.transition = 'none'
      backdrop.style.transition = 'none'
      ;(win.style as any).animation = 'none'
      return
    }
    modal.style.setProperty('--ipe-anim', name as string)
  }

  private _hooks: {
    type: IPEModalEvent
    listener: IPEModalHook
  }[] = []
  on(type: IPEModalEvent, listener: IPEModalHook) {
    this._hooks.push({ type, listener })
    return () => this.off(type, listener)
  }
  off(type: IPEModalEvent, listener: IPEModalHook) {
    this._hooks = this._hooks.filter((event) => event.type !== type || event.listener !== listener)
    return this
  }
  once(type: IPEModalEvent, listener: IPEModalHook) {
    const dispose = this.on(type, (ev) => {
      dispose()
      return listener(ev)
    })
    return dispose
  }
  private emit(type: IPEModalEvent, cancelable?: boolean): boolean {
    const hooks = this._hooks.filter((event) => event.type === type)
    let ret = true
    for (const hook of hooks) {
      const ev = new CustomEvent(type, { detail: this, cancelable })
      ret = hook.listener(ev) ?? ret
      if (ev.defaultPrevented) ret = false
      if (ret === false) break
    }
    return ret
  }

  private focusFirst() {
    const modal = this.get$modal()
    const fs = getFocusable(modal)
    if (fs.length) fs[0].focus()
    else modal.focus({ preventScroll: true })
  }

  private onKeyDown(e: KeyboardEvent) {
    // focus trap
    const modal = this.get$modal()
    if (!modal.contains(document.activeElement)) return

    if (e.key === 'Escape') {
      e.preventDefault()
      this.close()
      return
    }

    if (e.key === 'Tab') {
      const f = getFocusable(modal)
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      const active = document.activeElement as HTMLElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    // button keyPress mapping
    const btns = modal.querySelectorAll<HTMLElement>('.ipe-btn')
    btns.forEach((b) => {
      const key = (b as any)._ipe_key as string | undefined
      if (key && key.toLowerCase() === e.key.toLowerCase()) {
        b.click()
      }
    })
  }

  private startCloseTimer = (ms: number) => {
    this.stopCloseTimer()
    this.closeTimer = window.setTimeout(() => this.close(), ms)
  }

  private stopCloseTimer = () => {
    if (this.closeTimer) window.clearTimeout(this.closeTimer)
    this.closeTimer = undefined
  }

  setZIndex(z: number) {
    if (this.$backdrop) this.$backdrop.style.zIndex = String(z)
    if (this.$modal) this.$modal.style.zIndex = String(z + 1)
  }

  private isAnimationDisabled(): boolean {
    const anim = this.options.modalAnimation ?? this.options.animation
    return anim === false || anim == null
  }

  // ------------------------------ toast ------------------------------- //
  /** 以 Toast 形式展示（无遮罩、右下角堆叠） */
  showToast(): this {
    if (!this.$window) this.init()
    const container = ensureToastContainer()
    const win = this.get$window()
    this.isToast = true
    // 保证可交互
    win.style.pointerEvents = 'auto'
    container.appendChild(win)

    // 自动关闭逻辑（默认 3000ms，悬停重置）
    const time = this.options.closeAfter?.time ?? 3000
    const resetOnHover = this.options.closeAfter?.resetOnHover ?? true
    if (time > 0) {
      this.startCloseTimer(time)
      if (resetOnHover) {
        win.addEventListener('mouseenter', this.stopCloseTimer)
        win.addEventListener('mouseleave', () => this.startCloseTimer(time))
      }
    }

    this.isOpen = true
    this.options.onShow?.(this)
    TOASTS.push(this)
    // lifecycle: toast shown
    this.emit(IPEModalEvent.ToastShow)
    this.emit(IPEModalEvent.Show)
    return this
  }

  // ------------------------------ static helpers --------------------------- //
  static show(options: Partial<IPEModalOptions>, _element?: AnyContent) {
    const m = new IPEModal(options)
    return m.init().show()
  }

  static createObject(options: Partial<IPEModalOptions>, _element?: AnyContent) {
    return new IPEModal(options)
  }

  static close(modalId?: string | HTMLElement) {
    if (!modalId) {
      const top = STACK.top()
      top?.close()
      return top
    }
    const id = typeof modalId === 'string' ? modalId : modalId.id
    const modal = STACK.stack.find((m) => m.modalId === id)
    modal?.close()
    return modal
  }

  static closeAll(group?: string | string[], except?: string | string[]) {
    STACK.closeAll(group, except)
    return STACK.top() ?? new IPEModal()
  }

  static removeAll() {
    STACK.removeAll()
  }

  static dialog(options: Partial<IPEModalOptions>, method: (e: MouseEvent, m: IPEModal) => void) {
    const m = new IPEModal({
      sizeClass: 'dialog',
      buttons: [
        {
          label: 'OK',
          className: 'is-primary',
          method: (e, mm) => method(e, mm),
          keyPress: 'Enter',
        },
      ],
      ...options,
    })
    return m.init().show()
  }

  static confirm(
    options: Partial<IPEModalOptions> &
      Partial<{
        okBtn: Pick<IPEModalButtonOptions, 'label' | 'className'>
        cancelBtn: Pick<IPEModalButtonOptions, 'label' | 'className'>
      }>,
    method: (e: MouseEvent, m: IPEModal) => void
  ) {
    const ok = options.okBtn ?? { label: 'OK', className: 'is-primary' }
    const cancel = options.cancelBtn ?? { label: 'Cancel', className: 'is-ghost' }
    const m = new IPEModal({
      sizeClass: 'dialog',
      ...options,
      buttons: [
        {
          label: cancel.label,
          className: cancel.className,
          side: 'left',
          keyPress: 'n',
          method: () => m.close(),
        },
        { label: ok.label, className: ok.className, keyPress: 'y', method: (e) => method(e, m) },
      ],
    })
    return m.init().show()
  }

  static notify(
    type: 'success' | 'error' | 'warning' | 'info' | 'dialog' | 'confirm' | string,
    options: Partial<IPEModalOptions> &
      Partial<{
        icon: string
        okBtn: Pick<IPEModalButtonOptions, 'label' | 'className'>
        cancelBtn: Pick<IPEModalButtonOptions, 'label' | 'className'>
        overrideOther: boolean
      }>,
    callback?: (result: boolean) => void
  ) {
    if (options?.overrideOther) {
      ;[...TOASTS].forEach((t) => t.close())
    }

    const classes = `is-${type}`
    const m = new IPEModal({
      className: classes,
      sizeClass: 'dialog',
      center: false,
      fitScreen: false,
      closeIcon: true,
      outSideClose: false,
      bodyScroll: true,
      animation: false,
      buttons: options.buttons ?? [],
      closeAfter: options.closeAfter ?? { time: 3000, resetOnHover: true },
      ...options,
    })
    m.setPluginName('toast')
    return m.showToast()
  }
}

// ------------------------------ toast utils ------------------------------- //
const TOASTS: IPEModal[] = []
function ensureToastContainer(): HTMLDivElement {
  const id = 'ipe-toast-container'
  let el = document.getElementById(id) as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = id
    el.style.position = 'fixed'
    el.style.right = '16px'
    el.style.bottom = '16px'
    el.style.zIndex = '2000'
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.gap = '8px'
    el.style.alignItems = 'flex-end'
    // 允许子元素接收事件
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)
  }
  return el
}
