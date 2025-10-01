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
  closeAfter?: {
    /**
     * Close the modal/toast after `time` ms. For toast: defaults to 3000ms.
     */
    time: number
    /** Not used by library (reserved for UI display). */
    displayTime?: number
    /** Reset countdown when hovered. */
    resetOnHover?: boolean
  }

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
      $backdrop = document.createElement('div')
      $backdrop.id = this.backdropId
      $backdrop.className = `ipe-modal-backdrop`
      $backdrop.setAttribute('data-modal-id', this.modalId)
    }

    // Host
    const $modal = document.createElement('div') as HTMLDivElement & { modal: IPEModal }
    $modal.id = this.modalId
    $modal.className = 'ipe-modal-modal'
    $modal.role = 'dialog'
    $modal.ariaModal = 'true'
    $modal.tabIndex = -1 // make focusable for a11y/focus-trap fallback
    $modal.modal = this

    // If no backdrop, absolutely position around viewport top-center
    if (!hasBackdrop) {
      $modal.classList.add('no-backdrop')
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
      const viewportWidth = window.innerWidth

      $modal.style.top = `${scrollTop + 60}px`
      $modal.style.left = `${scrollLeft + viewportWidth / 2}px`
      $modal.style.transform = 'translateX(-50%)'
    }

    // Window
    const $window = document.createElement('div') as HTMLDivElement & { modal: IPEModal }
    $window.className = `ipe-modal-modal__window size--${this.options.sizeClass}`
    $window.modal = this

    // Header
    const $header = document.createElement('div')
    $header.className = 'ipe-modal-modal__header'

    const $title = document.createElement('div')
    $title.className = 'ipe-modal-modal__title'
    $title.role = 'heading'

    const $icons = document.createElement('div')
    $icons.className = 'ipe-modal-modal__icons'

    if (this.options.closeIcon) {
      const closeBtn = document.createElement('button')
      closeBtn.className = 'ipe-modal-modal__close'
      closeBtn.type = 'button'
      closeBtn.setAttribute('aria-label', 'Close')
      closeBtn.innerHTML = '&times;'
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
      $header.addEventListener('mousedown', this.onDragStart.bind(this))
      $header.addEventListener('touchstart', this.onDragStart.bind(this), { passive: false })
    }

    // Content
    const $content = document.createElement('div')
    $content.className = 'ipe-modal-modal__content'

    // Footer (buttons)
    const $footer = document.createElement('div')
    $footer.className = 'ipe-modal-modal__footer'

    const $btnsLeft = document.createElement('div')
    $btnsLeft.className = 'ipe-modal-modal__buttons ipe-modal-modal__buttons--left'

    const $btnsRight = document.createElement('div')
    $btnsRight.className = 'ipe-modal-modal__buttons ipe-modal-modal__buttons--right'

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
    this.$buttonsLeft = $btnsLeft
    this.$buttonsRight = $btnsRight

    // content + title + buttons
    if (this.options.title) this.setTitle(this.options.title)
    if (this.options.content) this.setContent(this.options.content)
    if (this.options.buttons?.length) {
      this.setButtons(this.options.buttons)
    } else {
      // hide footer if no buttons
      $footer.style.display = 'none'
    }

    // position helpers
    if (this.options.center) this.$modal.classList.add('is-centered')
    if (this.options.fitScreen) this.$modal.classList.add('is-fullscreen')
    if (this.options.className) {
      this.$window.classList.add(...this.options.className.split(/[\s\.#]+/g).filter(Boolean))
    }

    // interactions - backdrop close
    if ($backdrop) {
      $backdrop.addEventListener('mousedown', (e) => {
        if (!this.options.outSideClose) return
        if (e.target === $backdrop) {
          this.close()
        }
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
      if (!allowedByEvent || !allowedByHook) return this
    }

    // Toast: close immediately
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
    }

    STACK.remove(this)

    // unlock body scroll if this was the last locking modal
    if (this.shouldUnlockBodyOnClose()) STACK.unlockBodyScroll()

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
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `ipe-modal-modal__icon ${ic.className}`
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
    const base = type === 'link' ? document.createElement('a') : document.createElement('button')
    if (type === 'button') (base as HTMLButtonElement).type = 'button'

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

    // Keyboard shortcut mapping (handled in onKeyDown)
    if (opts.keyPress) (base as any)._ipe_key = opts.keyPress

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
    // Only top-most modal responds
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

    // button keyPress mapping
    const btns = modal.querySelectorAll<HTMLElement>('.ipe-modal-btn')
    btns.forEach((b) => {
      const key = (b as any)._ipe_key as string | undefined
      if (key && key.toLowerCase() === e.key.toLowerCase()) b.click()
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
  private onDragStart(e: MouseEvent | TouchEvent): void {
    // Only when no backdrop & draggable
    if (this.options.backdrop !== false || !this.options.draggable) return

    e.preventDefault()

    this.isDragging = true

    // Re-stack on drag start
    this.bringToFront()

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    this.dragStartX = clientX
    this.dragStartY = clientY

    const modal = this.get$modal()
    const rect = modal.getBoundingClientRect()

    this.modalStartX = rect.left + window.pageXOffset
    this.modalStartY = rect.top + window.pageYOffset

    // switch to left/top positioning for dragging
    modal.style.transform = 'none'
    modal.style.left = `${this.modalStartX}px`
    modal.style.top = `${this.modalStartY}px`

    document.addEventListener('mousemove', this.onDragMove)
    document.addEventListener('mouseup', this.onDragEnd)
    document.addEventListener('touchmove', this.onDragMove, { passive: false })
    document.addEventListener('touchend', this.onDragEnd)
    document.addEventListener('touchcancel', this.onDragEnd)

    modal.classList.add('is-dragging')
  }

  private onDragMove = (e: MouseEvent | TouchEvent): void => {
    if (!this.isDragging) return

    e.preventDefault()

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const deltaX = clientX - this.dragStartX
    const deltaY = clientY - this.dragStartY

    const modal = this.get$modal()
    const newX = this.modalStartX + deltaX
    const newY = this.modalStartY + deltaY

    modal.style.left = `${newX}px`
    modal.style.top = `${newY}px`
  }

  private onDragEnd = (): void => {
    if (!this.isDragging) return

    this.isDragging = false

    document.removeEventListener('mousemove', this.onDragMove)
    document.removeEventListener('mouseup', this.onDragEnd)
    document.removeEventListener('touchmove', this.onDragMove)
    document.removeEventListener('touchend', this.onDragEnd)
    document.removeEventListener('touchcancel', this.onDragEnd)

    const modal = this.get$modal()
    modal.classList.remove('is-dragging')
  }

  // ------------------------------ toast ------------------------------- //
  /** Show as toast (no backdrop, bottom-right stack). */
  showToast(): this {
    if (!this.$window) this.init()
    const container = ensureToastContainer()
    const win = this.get$window()
    this.isToast = true
    win.style.pointerEvents = 'auto' // allow interactions on toast
    container.appendChild(win)

    // auto close (default 3000ms; hover to pause)
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
    const m = new this({
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
    const m = new this({
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
    const m = new this({
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
  const id = 'ipe-modal-toast-container'
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
    // Allow children to receive pointer events; container ignores them
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)
  }
  return el
}
