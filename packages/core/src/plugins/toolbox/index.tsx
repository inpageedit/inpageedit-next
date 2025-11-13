import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit'
import { JSX, ReactElement } from 'jsx-dom'
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

interface ToolboxButton {
  id: string
  group?: 'auto' | 'group1' | 'group2'
  icon: ComputeAbleSync<string | HTMLElement | SVGElement | ReactElement>
  tooltip?: ComputeAbleSync<string | HTMLElement>
  itemProps?: JSX.IntrinsicElements['li']
  buttonProps?: JSX.IntrinsicElements['button']
  onClick?: (event: MouseEvent) => void
  index?: number // 任意数值均可：负数靠前、正数靠后、Infinity 末尾、未传时按插入顺序
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

  // ==== 内部状态 ====
  private buttons: ToolboxButton[] = []

  // 插入顺序序列号：用于当 index 未给时保持“自然顺序”
  private seqCounter = 0
  private seqMap = new Map<string, number>() // id -> seq

  constructor(public ctx: InPageEdit) {
    super(ctx, 'toolbox', false)
  }

  protected async start(): Promise<void> {
    this.container = this.createToolbox()
    this.ctx.preferences.get('toolboxAlwaysShow').then((val) => {
      if (val) {
        this.container.classList.add('is-persistent')
      }
    })
    this.setupHoverLogic()
    document.body.appendChild(this.container)

    // 国际化变化时重新渲染
    this.ctx.on('i18n/changed', () => {
      console.info('i18n/changed', this.buttons)
      this.renderAll()
    })
  }

  protected stop(): void | Promise<void> {
    this.container?.remove()
  }

  private get isPersistent() {
    return this.container.classList.contains('is-persistent')
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
      if (!this.isPersistent) {
        this.container.classList.add('is-hovered')
      }
    })

    // 鼠标离开时收起（如果不是持久化状态）
    this.container.addEventListener('mouseleave', () => {
      if (!this.isPersistent) {
        hoverTimeout = window.setTimeout(() => {
          this.container.classList.remove('is-hovered')
        }, 150) // 延迟150ms收起，避免快速移动鼠标时闪烁
      }
    })
  }

  /**
   * 计算按钮动画延迟
   * @param index 按钮索引（从0开始）
   * @param totalCount 总按钮数量
   * @returns 延迟时间（秒）
   */
  private calculateButtonDelay(index: number, totalCount: number): number {
    if (totalCount <= 1) return 0

    // 总动画时长150ms = 0.15s
    const totalDuration = 0.15
    // 使用平方根函数创建非线性延迟，差值逐渐缩小
    const normalizedIndex = index / (totalCount - 1)
    const delay = totalDuration * Math.sqrt(normalizedIndex)

    return Math.round(delay * 1000) / 1000 // 保留3位小数
  }

  /**
   * 更新按钮组的动画延迟
   */
  private updateButtonDelays() {
    const btnGroups = this.container.querySelectorAll('.btn-group')

    btnGroups.forEach((group) => {
      const buttons = group.querySelectorAll('.btn-tip-group')
      const totalCount = buttons.length

      buttons.forEach((button, index) => {
        const delay = this.calculateButtonDelay(index, totalCount)
        ;(button as HTMLElement).style.setProperty('--transition-delay', `${delay}s`)
        ;(button as HTMLElement).style.setProperty('--max-transition-delay', '0.15s')
      })
    })
  }

  private createToolbox() {
    const toggler = (
      <button
        className="ipe-toolbox-btn"
        id="toolbox-toggler"
        onClick={() => {
          this.toggle()
        }}
      >
        {/* Font Awesome 5 Solid: Plus */}
        <svg xmlns="http://www.w3.org/2000/svg" width="448" height="512" viewBox="0 0 448 512">
          <rect width="448" height="512" fill="none" />
          <path
            fill="currentColor"
            d="M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32"
          />
        </svg>
      </button>
    )
    const element = (
      <div id="ipe-edit-toolbox">
        <ul className="btn-group group1" style={{ display: 'flex', flexDirection: 'column' }}></ul>
        <ul className="btn-group group2" style={{ display: 'flex', flexDirection: 'row' }}></ul>
        {toggler}
      </div>
    )

    return element as HTMLElement
  }

  private normalizeButtonId(id: string) {
    if (!id) {
      id = Math.random().toString(36).substring(2, 8)
    }
    // 修复：正确替换空白/点/井号（保留语义，修正正则）
    return `ipe-toolbox__${id.trim()}`.replace(/[\s.#]+/g, '-')
  }

  // ====== 排序与分组 ======
  private chooseAutoGroup(): 'group1' | 'group2' {
    const g1 = this.buttons.filter((b) => b.group === 'group1').length
    const g2 = this.buttons.filter((b) => b.group === 'group2').length
    return g1 <= g2 ? 'group1' : 'group2'
  }

  // 归一化排序键：
  // 1) 若 index 是有限数值 => 直接使用（允许负数/小数/很大数）；
  // 2) 若为 Infinity / -Infinity => 自然比较；
  // 3) 若 NaN / 未提供 => 返回 null，后续用插入顺序（seq）比较。
  private orderKey(btn: ToolboxButton): number | null {
    const idx = (btn as any).index
    if (typeof idx === 'number') {
      if (Number.isNaN(idx)) return null
      return idx // 包含 Infinity 与 -Infinity
    }
    return null
  }

  private compareButtons = (a: ToolboxButton, b: ToolboxButton) => {
    const ak = this.orderKey(a) // number | null
    const bk = this.orderKey(b)

    const va = ak ?? 0
    const vb = bk ?? 0

    if (va < vb) return -1
    if (va > vb) return 1

    // 有效值相等时的细化：
    const sa = this.seqMap.get(a.id) ?? 0
    const sb = this.seqMap.get(b.id) ?? 0

    if (ak === null && bk === null) {
      if (sa !== sb) return sa - sb
      return 0 // 不以 id 再兜底，保持稳定排序
    }

    if (ak === null && bk !== null) return -1 // 无 index(按0) 优先于 数值 index=0
    if (ak !== null && bk === null) return 1

    // 双方都有 index 且值相等，退化到 seq；仍然相等时返回 0
    if (sa !== sb) return sa - sb
    return 0
  }

  // ====== 对外 API：新增/替换/删除 ======
  addButton(payload: ToolboxButton) {
    // 统一化 id（保留原意：若缺失则补）
    payload.id = (payload.id || '').trim()
    if (!payload.id) {
      this.ctx.logger('toolbox').warn('Button id is empty, generating a random one.')
      payload.id = Math.random().toString(36).slice(2, 10)
    }

    const existingIndex = this.buttons.findIndex((button) => button.id === payload.id)

    // 分组：新增时 auto，替换时默认保留原组，除非明确指定
    const nextGroup: 'group1' | 'group2' = (() => {
      if (existingIndex !== -1) {
        const old = this.buttons[existingIndex]
        return !payload.group || payload.group === 'auto' ? (old.group as any) : payload.group
      }
      return !payload.group || payload.group === 'auto' ? this.chooseAutoGroup() : payload.group
    })()

    // 序列号：用于 index 未提供时，保持插入顺序
    if (!this.seqMap.has(payload.id)) {
      this.seqMap.set(payload.id, this.seqCounter++)
    }

    if (existingIndex !== -1) {
      // 替换：保留旧的 seq，不动；index 未传则沿用旧值
      const old = this.buttons[existingIndex]
      const incomingIndex =
        typeof payload.index === 'number' && !Number.isNaN(payload.index)
          ? payload.index
          : old.index
      const merged: ToolboxButton = { ...old, ...payload, group: nextGroup, index: incomingIndex }

      this.buttons.splice(existingIndex, 1, merged)
    } else {
      // 新增：按给定 index 或留空；只设置组
      const incomingIndex =
        typeof payload.index === 'number' && !Number.isNaN(payload.index)
          ? payload.index
          : undefined
      const fresh: ToolboxButton = { ...payload, group: nextGroup, index: incomingIndex }
      this.buttons.push(fresh)
    }

    this.ctx.emit('toolbox/button-added', { ctx: this.ctx, payload })
    this.renderAll()
  }

  removeButton(id: string) {
    const index = this.buttons.findIndex((button) => button.id === id)
    if (index !== -1) {
      const payload = this.buttons[index]
      this.buttons.splice(index, 1)
      // 可选择是否保留 seq，使得将来同 id 重加时仍按旧顺序；这里删除时保留更合理
      this.ctx.emit('toolbox/button-removed', { ctx: this.ctx, payload })
      this.renderAll()
    }
  }

  // ====== 渲染 ======
  private renderButton(payload: ToolboxButton) {
    let { id, icon, index, tooltip, itemProps, buttonProps, onClick } = payload
    const normalizedId = this.normalizeButtonId(id)

    // 结构尽量保持，避免在 <li> 上绑定 click 造成双触发
    const element = (
      <li class="btn-tip-group" id={normalizedId} data-id={id} data-index={index} {...itemProps}>
        <div class="btn-tip">{computeFallbackSync(tooltip)}</div>
        <button
          id={`${normalizedId}-btn`}
          data-id={payload.id}
          class="ipe-toolbox-btn"
          onClick={(e: any) => {
            onClick?.(e as MouseEvent)
            this.ctx.emit('toolbox/button-clicked', {
              ctx: this.ctx,
              event: e as MouseEvent,
              payload,
            })
          }}
          {...buttonProps}
        >
          {computeFallbackSync(icon)}
        </button>
      </li>
    )

    return element as HTMLElement
  }

  private renderAll() {
    const group1 = this.buttons
      .filter((b) => b.group === 'group1')
      .slice()
      .sort(this.compareButtons)
    const group2 = this.buttons
      .filter((b) => b.group === 'group2')
      .slice()
      .sort(this.compareButtons)

    const group1El = this.container.querySelector('.btn-group.group1') as HTMLElement
    const group2El = this.container.querySelector('.btn-group.group2') as HTMLElement

    group1El.innerHTML = ''
    group2El.innerHTML = ''

    group1.forEach((button) => {
      group1El.appendChild(this.renderButton(button))
    })
    group2.forEach((button) => {
      group2El.appendChild(this.renderButton(button))
    })

    // 统一更新动画延迟
    this.updateButtonDelays()
  }

  getContainer() {
    return this.container
  }

  get isOpened() {
    return (
      this.container.classList.contains('is-persistent') ||
      this.container.classList.contains('is-hovered')
    )
  }

  toggle(force?: boolean) {
    const isPersistent = this.isPersistent
    const newPersistent = typeof force === 'boolean' ? force : !isPersistent
    this.container.classList.toggle('is-persistent', newPersistent)
    this.container.classList.remove('is-hovered')
    this.ctx.preferences.set('toolboxAlwaysShow', newPersistent)
    this.ctx.emit('toolbox/toggle', { ctx: this.ctx, opened: this.isOpened })
  }
}
