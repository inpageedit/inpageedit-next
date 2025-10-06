import './style.scss'

/* --------------------------------------------------------------------------
 * IPEModal (DOM-only modal/toast utility)
 * --------------------------------------------------------------------------
 * - No jQuery
 * - DOM-only API
 * - Basic a11y (aria-modal, role, focus trap, ESC)
 * - CSS-driven animations via classes + CSS variables
 * - Helpers: dialog, confirm, notify (toast)
 * -------------------------------------------------------------------------- */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
      /** animation name when showing; set false to disable */
      show?: string | false
      /** animation name when hiding; set false to disable */
      hide?: string | false
    }
  | false

export type AnyContent = string | Node | any

export interface IPEModalButtonOptions {
  /** Button label content (text node by default; not parsed as HTML). */
  label: AnyContent
  /** Render as <button> (default) or <a>. */
  type?: 'button' | 'link'
  /** Extra class names. */
  className?: string
  /** Enable the button after N ms; set false to skip. */
  enableAfter?: number | false
  /** Element id attribute. */
  id?: string
  /** Click handler; `this` is the element; receives mouse event and modal instance. */
  method?: (this: HTMLButtonElement | HTMLAnchorElement, event: MouseEvent, modal: IPEModal) => void
  /** Button group side within footer. */
  side?: 'left' | 'right'
  /** Keyboard shortcut for this button (e.g. 'Enter' | 'Escape' | 'y'). */
  keyPress?: string
  /** Close modal after N ms once the button is clicked; set false to skip. */
  closeAfter?: number | false
  /** Only for type:'link'. */
  href?: string
}

export interface IPEModalOptions {
  // --- visual --------------------------------------------------------------
  /** Extra class names applied to the window element. */
  className?: string
  /** Predefined size class. */
  sizeClass?: SsiModalSizeClass
  /** Center the modal (adds .is-centered on host). */
  center?: boolean
  /** Keep a fixed height (px) or enable fixed-height mode; layout via CSS. */
  fixedHeight?: boolean | number
  /** Fullscreen layout helper. */
  fitScreen?: boolean
  /** Render icon-style buttons in header (styling only). */
  iconButtons?: boolean
  /** Show close (×) icon in header. */
  closeIcon?: boolean

  // --- content -------------------------------------------------------------
  title?: AnyContent
  content?: AnyContent
  buttons?: Partial<IPEModalButtonOptions>[]

  // --- behavior ------------------------------------------------------------
  /**
   * Backdrop behavior:
   * - true (default): dedicated backdrop per modal
   * - 'shared' or 'byKindShared': reserved for external coordination
   * - false: no backdrop (floating window)
   */
  backdrop?: boolean | 'shared' | 'byKindShared'
  /**
   * Close when clicking on the backdrop. Ignored when `backdrop === false`.
   */
  outSideClose?: boolean
  /**
   * Allow body scrolling while the modal is open. Default: **false** (lock scroll).
   */
  bodyScroll?: boolean
  /** Stack behavior placeholder (kept for parity). */
  stack?: boolean
  /** Navigation placeholder (kept for parity). */
  navigation?: boolean
  /** Enable drag only when `backdrop === false`. */
  draggable?: boolean

  // --- timing & animations -------------------------------------------------
  /** Window animation (or legacy `animation`). */
  animation?: IPEModalAnimation
  /** Preferred: animation for modal window element. */
  modalAnimation?: IPEModalAnimation
  /** Animation for backdrop element. */
  backdropAnimation?: IPEModalAnimation
  /**
   * Fallback duration (ms) used when CSS events are not observable.
   */
  animationSpeed?: number
  /** Auto-close options. */
  closeAfter?:
    | {
        /**
         * Close the modal/toast after `time` ms. For toast: defaults to 3000ms.
         */
        time: number
        /** Not used by library (reserved for UI display). */
        displayTime?: number
        /** Reset countdown when hovered. */
        resetOnHover?: boolean
      }
    | number

  // --- positioning ---------------------------------------------------------
  /** Kept for parity; CSS controls actual layout. */
  position?:
    | 'right top'
    | 'right bottom'
    | 'left top'
    | 'left bottom'
    | 'center top'
    | 'center bottom'

  // --- callbacks -----------------------------------------------------------
  /** Return false to cancel showing. */
  beforeShow?: (modal: IPEModal) => boolean | void
  onShow?: (modal: IPEModal) => void
  /** Return false to cancel closing. */
  beforeClose?: (modal: IPEModal) => boolean | void
  onClose?: (modal: IPEModal) => void
  /**
   * Called when clicking the close icon. If a function returns false or value is `false`,
   * the modal will NOT close. If value is `true` or omitted, it closes as usual.
   */
  onClickClose?: boolean | ((modal: IPEModal) => boolean | void)
}

export type IPEModalNotifyType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'dialog'
  | 'confirm'
  | string
export type IPEModalNotifyPosition = 'top right' | 'top left' | 'bottom right' | 'bottom left'

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
  // Already a Node (HTMLElement, Text, DocumentFragment, etc.)
  if (v instanceof Node) return v
  // Strings are treated as textContent for safety
  return document.createTextNode(String(v))
}

function assertEl<T extends HTMLElement>(el: T | null | undefined, name?: string): T {
  if (!el) throw new Error(`${name ?? 'Element'} not found`)
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

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { className?: string; attrs?: Record<string, string>; html?: string; text?: string } = {}
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (opts.className) el.className = opts.className
  if (opts.html != null) el.innerHTML = opts.html
  if (opts.text != null) el.textContent = opts.text
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) el.setAttribute(k, v)
  }
  return el
}

// Simple stack manager（仅管理“模态”窗口，不含 Toast）
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
    // Keep each modal above its own backdrop
    this.stack.forEach((m, i) => m.setZIndex(this.zBase + i * 2))
  }

  lockBodyScroll() {
    document.documentElement.classList.add('ipe-modal-no-scroll')
  }

  unlockBodyScroll() {
    document.documentElement.classList.remove('ipe-modal-no-scroll')
  }
}
const STACK = new ModalStackManager()

// ---------------------------------------------------------------------------
// IPEModal class (DOM-only)
// ---------------------------------------------------------------------------
export class IPEModal {
  // public ids
  readonly backdropId = nextId('ipe-modal-backdrop')
  readonly modalId = nextId('ipe-modal')
  readonly numberId = this.modalId.split('-')[1]
  private _isDestroyed = false
  get isDestroyed() {
    return this._isDestroyed
  }

  // options
  options: IPEModalOptions
  /** Logical grouping for stack ops (e.g., 'toast'). */
  pluginName = 'normalModal'

  // elements
  private $backdrop?: HTMLDivElement
  private $modal?: HTMLDivElement & { modal: IPEModal } // host container (independent from backdrop)
  private $window?: HTMLDivElement & { modal: IPEModal } // actual dialog window
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
  private keyMap: Map<string, HTMLElement> = new Map() // 键盘快捷键映射

  // state
  private isOpen = false
  private lastFocused?: HTMLElement | null
  private closeTimer?: number
  private isToast = false

  // drag state
  private isDragging = false
  private dragStartX = 0
  private dragStartY = 0
  private modalStartX = 0
  private modalStartY = 0

  // public helpers
  Event = IPEModalEvent

  DEFAULT_OPTIONS: IPEModalOptions = {
    className: '',
    sizeClass: 'auto',
    center: true,
    fitScreen: false,
    closeIcon: true,
    bodyScroll: false, // lock body scroll by default
    outSideClose: true,
    backdrop: true,
    animation: false, // no transitions by default
    animationSpeed: 200,
  }

  constructor(options: Partial<IPEModalOptions> = {}) {
    this.options = { ...this.DEFAULT_OPTIONS, ...options }
    // If there's no backdrop, allow page scroll unless user explicitly overrides
    if (this.options.backdrop === false && options.bodyScroll === undefined) {
      this.options.bodyScroll = true
    }
  }

  // ------------------------------ lifecycle ------------------------------ //
  init(): this {
    if (this.$modal) return this

    const hasBackdrop = this.options.backdrop !== false

    // Backdrop (only when needed)
    let $backdrop: HTMLDivElement | undefined
    if (hasBackdrop) {
      $backdrop = createEl('div', {
        className: 'ipe-modal-backdrop',
        attrs: { id: this.backdropId, 'data-modal-id': this.modalId },
      }) as HTMLDivElement
    }

    // Host
    const $modal = createEl('div', {
      className: 'ipe-modal-modal',
      attrs: { id: this.modalId, role: 'dialog', 'aria-modal': 'true', tabindex: '-1' },
    }) as HTMLDivElement & { modal: IPEModal }
    $modal.modal = this

    // If no backdrop, absolutely position around viewport top-center
    if (!hasBackdrop) {
      $modal.classList.add('no-backdrop')
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
      const viewportWidth = window.innerWidth

      $modal.style.top = `${scrollTop + 60}px`
      this.once(IPEModalEvent.Show, () => {
        $modal.style.left = `${scrollLeft + viewportWidth / 2 - $modal.offsetWidth / 2}px`
      })
    }

    // Window
    const $window = createEl('div', {
      className: `ipe-modal-modal__window size--${this.options.sizeClass || 'auto'} plugin--${
        this.pluginName
      }`,
    }) as HTMLDivElement & { modal: IPEModal }
    $window.modal = this

    // Header
    const $header = createEl('div', { className: 'ipe-modal-modal__header' })

    const titleId = `${this.modalId}-title`
    const $title = createEl('h2', {
      className: 'ipe-modal-modal__title',
      attrs: { id: titleId, role: 'heading', 'aria-level': '2' },
    }) as HTMLHeadingElement
    $modal.setAttribute('aria-labelledby', titleId)

    const $icons = createEl('div', { className: 'ipe-modal-modal__icons' })

    if (this.options.closeIcon) {
      const closeBtn = createEl('button', {
        className: 'ipe-modal-modal__close',
        attrs: { type: 'button', 'aria-label': 'Close' },
        html: '&times;',
      }) as HTMLButtonElement
      closeBtn.addEventListener('click', () => {
        let proceed = true
        if (typeof this.options.onClickClose === 'function') {
          const res = this.options.onClickClose(this)
          if (res === false) proceed = false
        } else if (this.options.onClickClose === false) {
          proceed = false
        }
        if (proceed) this.close()
      })
      $icons.appendChild(closeBtn)
    }

    $header.append($title, $icons)

    // Enable drag (only when no backdrop)
    if (!hasBackdrop && this.options.draggable) {
      $header.style.cursor = 'move'
      $header.style.userSelect = 'none'
      $header.addEventListener('pointerdown', this.onDragStart.bind(this))
    }

    // Content
    const $content = createEl('div', { className: 'ipe-modal-modal__content' })

    // Footer (buttons)
    const $footer = createEl('div', { className: 'ipe-modal-modal__footer' })

    const $btnsLeft = createEl('div', {
      className: 'ipe-modal-modal__buttons ipe-modal-modal__buttons--left',
    })

    const $btnsRight = createEl('div', {
      className: 'ipe-modal-modal__buttons ipe-modal-modal__buttons--right',
    })

    $footer.append($btnsLeft, $btnsRight)

    $window.append($header, $content, $footer)
    $modal.appendChild($window)

    // store refs
    this.$backdrop = $backdrop
    this.$modal = $modal
    this.$window = $window
    this.$header = $header
    this.$title = $title
    this.$icons = $icons
    this.$content = $content
    this.$footer = $footer
    this.$buttonsLeft = $btnsLeft as HTMLDivElement
    this.$buttonsRight = $btnsRight as HTMLDivElement

    // content + title + buttons
    if (this.options.title) this.setTitle(this.options.title)
    if (this.options.content) this.setContent(this.options.content)
    if (this.options.buttons?.length) {
      this.setButtons(this.options.buttons)
    } else {
      // hide footer if no buttons
      $footer.style.display = 'none'
    }

    // position helpers & classes
    if (this.options.center) this.$modal.classList.add('is-centered')
    if (this.options.fitScreen) this.$modal.classList.add('is-fullscreen')
    if (this.options.iconButtons) this.$header.classList.add('has-icon-buttons')
    if (this.options.className) {
      this.$window.classList.add(...this.options.className.split(/[\s\.#+]+/g).filter(Boolean))
    }

    // fixedHeight 支持：true => 使用 CSS 布局；number => 直接设定高度
    if (typeof this.options.fixedHeight === 'number') {
      this.$window.style.height = `${Math.max(0, this.options.fixedHeight)}px`
    } else if (this.options.fixedHeight === true) {
      this.$window.classList.add('is-fixed-height')
    }

    // interactions - backdrop close（使用 pointerdown 兼容触控）
    if ($backdrop) {
      $backdrop.addEventListener('pointerdown', (e) => {
        if (!this.options.outSideClose) return
        if (e.target === $backdrop) this.close()
      })
    }

    // keyboard
    this.onKeyDown = this.onKeyDown.bind(this)

    // lifecycle: init
    this.emit(IPEModalEvent.Init)
    return this
  }

  show(): this {
    if (!this.$modal) this.init()
    if (!this.$modal) throw new Error('Failed to initialize modal')
    if (this.isOpen) return this // 避免重复 show

    // beforeShow lifecycle (cancelable)
    {
      const allowedByEvent = this.emit(IPEModalEvent.BeforeShow, true)
      const allowedByHook = this.options.beforeShow ? this.options.beforeShow(this) !== false : true
      if (!allowedByEvent || !allowedByHook) return this
    }

    // save focus & trap
    this.lastFocused = (document.activeElement as HTMLElement) ?? null

    // mount nodes
    if (this.$backdrop) document.body.appendChild(this.$backdrop)
    document.body.appendChild(this.$modal)

    // lock body scroll if needed (only for backdrop modals)
    if (this.shouldLockBodyOnOpen()) STACK.lockBodyScroll()

    requestAnimationFrame(() => {
      this.$backdrop?.classList.add('is-open')
      this.$modal!.classList.add('is-open')
      this.applyAnimation(true)
      this.focusFirst()
    })

    document.addEventListener('keydown', this.onKeyDown)
    STACK.push(this)

    this.isOpen = true
    this.options.onShow?.(this)
    this.emit(IPEModalEvent.Show)

    // auto close
    const closeAfterTime =
      typeof this.options.closeAfter === 'number'
        ? this.options.closeAfter
        : this.options.closeAfter?.time
    const resetOnHover =
      typeof this.options.closeAfter === 'number' ? true : this.options.closeAfter?.resetOnHover
    if (closeAfterTime) {
      this.startCloseTimer(closeAfterTime)
      if (resetOnHover) {
        this.$window?.addEventListener('mouseenter', this.stopCloseTimer)
        this.$window?.addEventListener('mouseleave', () => this.startCloseTimer(closeAfterTime))
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
      if (!allowedByEvent || !allowedByHook) return this
    }

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

    // Prefer CSS events, fallback to configured duration
    const fallback = this.isAnimationDisabled() ? 0 : (this.options.animationSpeed ?? 200)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      this.destroy()
      this.options.onClose?.(this)
    }
    const once = (el: HTMLElement, type: 'transitionend' | 'animationend') => {
      const handler = () => {
        el.removeEventListener(type, handler)
        finish()
      }
      el.addEventListener(type, handler, { once: true })
    }
    if (fallback > 0 && this.$window) {
      once(this.$window, 'transitionend')
      once(this.$window, 'animationend')
      window.setTimeout(finish, fallback + 20)
    } else {
      window.setTimeout(finish, fallback)
    }

    return this
  }

  /** Immediately removes DOM and listeners */
  destroy(): this {
    if (this._isDestroyed) return this

    this.stopCloseTimer()
    document.removeEventListener('keydown', this.onKeyDown)

    // cleanup drag listeners if any
    if (this.isDragging) this.onDragEnd()

    this.$window?.removeEventListener('mouseenter', this.stopCloseTimer)

    if (this.isToast) {
      // Toast: only remove window node
      if (this.$window?.parentElement) this.$window.parentElement.removeChild(this.$window)
      // Remove from TOASTS registry
      const idx = TOASTS.indexOf(this)
      if (idx !== -1) TOASTS.splice(idx, 1)
    } else {
      if (this.$backdrop?.parentElement) this.$backdrop.parentElement.removeChild(this.$backdrop)
      if (this.$modal?.parentElement) this.$modal.parentElement.removeChild(this.$modal)
      STACK.remove(this)
      // unlock body scroll if this was the last locking modal
      if (this.shouldUnlockBodyOnClose()) STACK.unlockBodyScroll()
    }

    this.isOpen = false

    // restore focus
    this.lastFocused?.focus?.()

    this.emit(IPEModalEvent.Destroy)
    this._isDestroyed = true
    return this
  }

  // ------------------------------ getters ------------------------------- //
  get$backdrop(): HTMLDivElement | undefined {
    return this.$backdrop
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
      const btn = createEl('button', {
        className: `ipe-modal-modal__icon ${ic.className}`,
        attrs: { type: 'button' },
      }) as HTMLButtonElement
      btn.addEventListener('click', ic.method)
      wrap.appendChild(btn)
    }
    return this
  }

  setButtons(buttons: Partial<IPEModalButtonOptions>[], area?: HTMLElement): this {
    const left = this.$buttonsLeft!
    const right = this.$buttonsRight!
    ;[left, right].forEach((c) => (c.innerHTML = ''))
    this.buttonElsLeft = []
    this.buttonElsRight = []
    this.keyMap.clear()

    const target = area ?? this.$footer!

    if (target === this.$footer) {
      // Use footer containers (with sides)
      buttons.forEach((b) => this.addButton(b))
      if (buttons.length === 0) this.$footer!.style.display = 'none'
    } else {
      // Custom area: render buttons directly into the provided container
      target.innerHTML = ''
      for (const b of buttons) {
        const el = this.generateButton(b)
        target.appendChild(el)
      }
    }

    return this
  }

  generateButton(opts: Partial<IPEModalButtonOptions>): HTMLButtonElement | HTMLAnchorElement {
    const type = opts.type ?? 'button'
    const base = (
      type === 'link' ? createEl('a') : createEl('button', { attrs: { type: 'button' } })
    ) as HTMLAnchorElement | HTMLButtonElement

    if (opts.id) base.id = opts.id
    base.className = `ipe-modal-btn ${opts.className ?? ''}`.trim()

    const labelNode = toNode(opts.label ?? 'OK')
    base.append(labelNode)

    if (type === 'link' && opts.href) (base as HTMLAnchorElement).href = opts.href

    // Click method
    if (opts.method) {
      base.addEventListener('click', (e) => {
        // Ignore click when temporarily disabled via enableAfter
        if ((base as any)._ipe_tmpDisabled) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        opts.method!.call(base as any, e as MouseEvent, this)
      })
    }

    // Delayed close after click
    if (typeof opts.closeAfter === 'number' && opts.closeAfter >= 0) {
      base.addEventListener('click', () => {
        window.setTimeout(() => this.close(), opts.closeAfter as number)
      })
    }

    // Enable after N ms (works for <a> and <button>)
    if (typeof opts.enableAfter === 'number' && opts.enableAfter > 0) {
      if (type === 'button') base.setAttribute('disabled', 'true')
      ;(base as any)._ipe_tmpDisabled = true
      base.setAttribute('aria-disabled', 'true')
      const unblock = () => {
        if (type === 'button') base.removeAttribute('disabled')
        delete (base as any)._ipe_tmpDisabled
        base.removeAttribute('aria-disabled')
      }
      window.setTimeout(unblock, opts.enableAfter)
    }

    // Keyboard shortcut mapping
    if (opts.keyPress) this.keyMap.set(String(opts.keyPress).toLowerCase(), base)

    return base
  }

  /** Dynamically add button(s) into footer. Supports insertion index per side. */
  addButton(opts: Partial<IPEModalButtonOptions>, index?: number): this {
    if (this.$footer) this.$footer.style.display = ''

    const side = opts.side ?? 'right'
    const container = side === 'left' ? this.$buttonsLeft! : this.$buttonsRight!
    const list = side === 'left' ? this.buttonElsLeft : this.buttonElsRight
    const el = this.generateButton(opts)

    const insertAt = Math.max(0, Math.min(index ?? list.length, list.length))
    if (insertAt >= container.children.length) container.appendChild(el)
    else container.insertBefore(el, container.children[insertAt])
    list.splice(insertAt, 0, el)
    return this
  }

  /** Remove button by element / id / global index (left first, then right). */
  removeButton(target: number | string | HTMLElement): this {
    const left = this.buttonElsLeft
    const right = this.buttonElsRight
    const combined = [...left, ...right]

    let el: HTMLElement | null = null
    if (typeof target === 'number') el = combined[target] ?? null
    else if (typeof target === 'string') el = combined.find((e) => e.id === target) ?? null
    else if (target instanceof HTMLElement) el = combined.find((e) => e === target) ?? null

    if (!el) return this

    // 同步移除 keyMap 中的快捷键映射（若存在）
    for (const [k, v] of this.keyMap.entries()) if (v === el) this.keyMap.delete(k)

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

    if (left.length === 0 && right.length === 0 && this.$footer) this.$footer.style.display = 'none'
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
    if (this.$window) {
      this.$window.className = this.$window.className.replace(
        `plugin--${this.pluginName}`,
        `plugin--${name}`
      )
    }
    this.pluginName = name
    return this
  }

  // ------------------------------ helpers ------------------------------- //
  private applyAnimation(show: boolean) {
    const modal = this.get$modal()
    const win = this.get$window()
    const bdp = this.$backdrop

    const animWin = this.options.modalAnimation ?? this.options.animation
    const nameWin =
      typeof animWin === 'string' ? animWin : animWin && (show ? animWin.show : animWin.hide)
    const animBdp = this.options.backdropAnimation ?? this.options.animation
    const nameBdp =
      typeof animBdp === 'string' ? animBdp : animBdp && (show ? animBdp.show : animBdp.hide)

    if (!nameWin || (nameWin as any) === false) {
      modal.style.transition = 'none'
      ;(win.style as any).animation = 'none'
      win.style.removeProperty('--ipe-modal-anim')
    } else {
      modal.style.removeProperty('transition')
      win.style.setProperty('--ipe-modal-anim', nameWin as string)
    }

    if (bdp) {
      if (!nameBdp || (nameBdp as any) === false) bdp.style.transition = 'none'
      else bdp.style.removeProperty('transition')
    }
  }

  private _hooks: { type: IPEModalEvent; listener: IPEModalHook }[] = []
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
    // Fire internal hooks first
    const hooks = this._hooks.filter((event) => event.type === type)
    let proceed = true
    for (const hook of hooks) {
      const ev = new CustomEvent(type, { detail: this, cancelable })
      const ret = hook.listener(ev)
      if (ev.defaultPrevented) proceed = false
      if (ret === false) proceed = false
      if (!proceed) break
    }

    // Then dispatch a DOM event for external listeners
    const target = this.$modal ?? document.body
    const domEv = new CustomEvent(type, { detail: this, cancelable })
    const dispatched = target.dispatchEvent(domEv)
    if (!dispatched || domEv.defaultPrevented) proceed = false

    return proceed
  }

  private focusFirst() {
    const modal = this.get$modal()
    const fs = getFocusable(modal)
    if (fs.length) fs[0].focus()
    else modal.focus({ preventScroll: true })
  }

  private onKeyDown(e: KeyboardEvent) {
    // Only top-most modal responds（Toast 不绑定全局 keydown）
    if (STACK.top() !== this) return

    // Close on ESC regardless of current focus
    if (e.key === 'Escape') {
      e.preventDefault()
      this.close()
      return
    }

    // Focus trap only when focus is inside current modal
    const modal = this.get$modal()
    if (!modal.contains(document.activeElement)) return

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

    // button keyPress mapping（O(1) 查表）
    const hit = this.keyMap.get(e.key.toLowerCase())
    if (hit) (hit as HTMLElement).click()
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
    // ensure modal is above its backdrop
    if (this.$backdrop) this.$backdrop.style.zIndex = String(z)
    if (this.$modal) this.$modal.style.zIndex = String(z + 1)
  }

  /** Bring this modal to the top of the stack. */
  bringToFront(): this {
    STACK.remove(this)
    STACK.push(this)
    return this
  }

  private isAnimationDisabled(): boolean {
    const anim = this.options.modalAnimation ?? this.options.animation
    return anim === false || anim == null
  }

  private shouldLockBodyOnOpen(): boolean {
    if (this.options.backdrop === false) return false
    if (this.options.bodyScroll !== false) return false
    const hasOtherLocking = STACK.stack.some(
      (m) => m !== this && m.options.backdrop !== false && m.options.bodyScroll === false
    )
    return !hasOtherLocking
  }

  private shouldUnlockBodyOnClose(): boolean {
    if (this.options.backdrop === false) return false
    if (this.options.bodyScroll !== false) return false
    const hasOtherLocking = STACK.stack.some(
      (m) => m !== this && m.options.backdrop !== false && m.options.bodyScroll === false
    )
    return !hasOtherLocking
  }

  // ------------------------------ drag handlers ------------------------------- //
  private onDragStart(e: PointerEvent): void {
    // Only when no backdrop & draggable
    if (this.options.backdrop !== false || !this.options.draggable) return

    e.preventDefault()

    this.isDragging = true

    // Re-stack on drag start
    this.bringToFront()

    this.dragStartX = e.clientX
    this.dragStartY = e.clientY

    const modal = this.get$modal()
    const rect = modal.getBoundingClientRect()

    this.modalStartX = rect.left + window.pageXOffset
    this.modalStartY = rect.top + window.pageYOffset

    // switch to left/top positioning for dragging
    modal.style.transform = 'none'
    modal.style.left = `${this.modalStartX}px`
    modal.style.top = `${this.modalStartY}px`

    document.addEventListener('pointermove', this.onDragMove)
    document.addEventListener('pointerup', this.onDragEnd)

    modal.classList.add('is-dragging')
  }

  private onDragMove = (e: PointerEvent): void => {
    if (!this.isDragging) return
    e.preventDefault()

    const deltaX = e.clientX - this.dragStartX
    const deltaY = e.clientY - this.dragStartY

    const modal = this.get$modal()
    const newX = this.modalStartX + deltaX
    const newY = this.modalStartY + deltaY

    modal.style.left = `${newX}px`
    modal.style.top = `${newY}px`
  }

  private onDragEnd = (): void => {
    if (!this.isDragging) return

    this.isDragging = false

    document.removeEventListener('pointermove', this.onDragMove)
    document.removeEventListener('pointerup', this.onDragEnd)

    const modal = this.get$modal()
    modal.classList.remove('is-dragging')
  }

  // ------------------------------ toast ------------------------------- //
  /** Show as toast (no backdrop, container stack). */
  showToast(
    options: Partial<{
      position: IPEModalNotifyPosition
    }>
  ): this {
    if (!this.$window) this.init()
    const container = ensureToastContainer(options.position ?? 'top right')
    const win = this.get$window()
    this.isToast = true
    win.style.pointerEvents = 'auto' // allow interactions on toast

    // 让 Toast 也具备进入动画
    this.applyAnimation(true)

    container.appendChild(win)

    // auto close (default 3000ms; hover to pause)
    const closeAfterTime =
      (typeof this.options.closeAfter === 'number'
        ? this.options.closeAfter
        : this.options.closeAfter?.time) ?? 3000
    const resetOnHover =
      (typeof this.options.closeAfter === 'number'
        ? true
        : this.options.closeAfter?.resetOnHover) ?? true
    if (closeAfterTime > 0) {
      this.startCloseTimer(closeAfterTime)
      if (resetOnHover) {
        win.addEventListener('mouseenter', this.stopCloseTimer)
        win.addEventListener('mouseleave', () => this.startCloseTimer(closeAfterTime))
      }
    }

    this.isOpen = true
    this.options.onShow?.(this)
    TOASTS.push(this)
    this.emit(IPEModalEvent.ToastShow)
    this.emit(IPEModalEvent.Show)
    return this
  }

  // ------------------------------ static helpers --------------------------- //
  static show(options: Partial<IPEModalOptions>, _element?: AnyContent) {
    const m = new this(options)
    return m.init().show()
  }

  static createObject(options: Partial<IPEModalOptions>, _element?: AnyContent) {
    return new this(options)
  }

  static close(modalId?: string | HTMLElement) {
    // 先找 modal 堆栈，再找 toast
    if (!modalId) {
      const top = STACK.top()
      top?.close()
      return top
    }
    const id = typeof modalId === 'string' ? modalId : modalId.id
    const modal = STACK.stack.find((m) => m.modalId === id)
    if (modal) {
      modal.close()
      return modal
    }
    const toast = TOASTS.find((t) => t.modalId === id)
    toast?.close()
    return toast
  }

  static closeAll(group?: string | string[], except?: string | string[]) {
    // 统一关闭：Modal + Toast
    const exceptSet = new Set((Array.isArray(except) ? except : except ? [except] : []).map(String))
    const groupSet = new Set((Array.isArray(group) ? group : group ? [group] : []).map(String))

    // modals
    STACK.closeAll(group, except)

    // toasts
    ;[...TOASTS].forEach((t) => {
      const id = t.modalId
      const belongs = groupSet.size ? groupSet.has(t.pluginName) : true
      const excluded = exceptSet.has(id)
      if (belongs && !excluded) t.close()
    })

    return STACK.top() ?? new IPEModal()
  }

  static removeAll() {
    STACK.removeAll()
    ;[...TOASTS].forEach((t) => t.destroy())
  }

  static dialog(options: Partial<IPEModalOptions>, method: (e: MouseEvent, m: IPEModal) => void) {
    const m = new this({
      sizeClass: 'dialog',
      buttons: [
        {
          label: 'OK',
          className: 'is-primary',
          method: (e, mm) => {
            method?.(e, mm)
            if (!e.defaultPrevented) m.close()
          },
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
    options.title ??= 'Confirm'
    const ok = options.okBtn ?? { label: 'OK', className: 'is-primary' }
    const cancel = options.cancelBtn ?? { label: 'Cancel', className: 'is-danger is-ghost' }
    const m = new this({
      sizeClass: 'dialog',
      ...options,
      buttons: [
        {
          label: cancel.label,
          className: cancel.className,
          keyPress: 'n',
          method: () => m.close(),
        },
        {
          label: ok.label,
          className: ok.className,
          keyPress: 'y',
          method: (e) => {
            method?.(e, m)
            if (!e.defaultPrevented) m.close()
          },
        },
      ],
    })
    return m.init().show()
  }

  static notifyIcons: Record<IPEModalNotifyType, string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    dialog: '💬',
    confirm: '💬',
  }
  static notify(
    type: IPEModalNotifyType,
    options: Partial<IPEModalOptions> &
      Partial<{
        icon: string
        okBtn: Pick<IPEModalButtonOptions, 'label' | 'className'>
        cancelBtn: Pick<IPEModalButtonOptions, 'label' | 'className'>
        overrideOther: boolean
        position: IPEModalNotifyPosition
      }>,
    callback?: (result: boolean) => void
  ) {
    if (options?.overrideOther) {
      ;[...TOASTS].forEach((t) => t.close())
    }

    if (typeof options.title === 'undefined') {
      options.title = type[0].toUpperCase() + type.slice(1).toLowerCase()
    }
    const icon = this.notifyIcons[type]
    options.title = `${icon} ${options.title}`.trimStart()

    if (options.okBtn) {
      options.okBtn.label ??= 'OK'
      options.okBtn.className ??= 'is-primary is-ghost ok-btn'
      ;(options.okBtn as Partial<IPEModalButtonOptions>).method = () => {
        callback?.(true)
        m.close()
      }
    }
    if (options.cancelBtn) {
      options.cancelBtn.label ??= 'Cancel'
      options.cancelBtn.className ??= 'is-danger is-ghost cancel-btn'
      ;(options.cancelBtn as Partial<IPEModalButtonOptions>).method = () => {
        callback?.(false)
        m.close()
      }
    }
    options.buttons = [options.okBtn, options.cancelBtn, ...(options.buttons ?? [])].filter(
      Boolean
    ) as Partial<IPEModalButtonOptions>[]

    const classes = `is-${type || 'dialog'} is-toast compact-buttons ${options.className ?? ''}`
    const m = new this({
      ...options,
      className: classes,
      sizeClass: 'auto',
      center: false,
      fitScreen: false,
      closeIcon: true,
      outSideClose: false,
      bodyScroll: true,
      animation: options.animation ?? {
        show: 'fadeIn',
        hide: 'fadeOut',
      },
      buttons: options.buttons ?? [],
    })
    m.setPluginName('toast')
    return m.showToast({
      position: options.position ?? 'top right',
    })
  }
}

// ------------------------------ toast utils ------------------------------- //
const TOASTS: IPEModal[] = []
function ensureToastContainer(position: IPEModalNotifyPosition = 'top right'): HTMLDivElement {
  const className = 'ipe-modal-toast-container'
  const id = `${className}-${position.replace(/[\s-\.|\/]+/g, '-')}`
  let el = document.getElementById(id) as HTMLDivElement | null
  if (!el) {
    el = createEl('div', {
      className: `${className} ${position}`,
      attrs: { id, 'data-position': position },
    }) as HTMLDivElement
    document.body.appendChild(el)
  }
  return el
}
