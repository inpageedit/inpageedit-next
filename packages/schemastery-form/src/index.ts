/**
 * SchemaForm
 * 一个基于 Schemastery 的 Web Components 表单生成器
 *
 * ✅ 使用 TypeScript，组件前缀统一为 <schema-*>
 * ✅ 简单样式 + 通过 CSS 变量 --schema-* 配置主题
 * ✅ 暴露 API：设置/获取表单数据、设置 Schema、校验
 * ✅ 支持的类型：string / number / boolean / date / const / object / array / tuple / dict / union
 * ✅ 支持按类型拆分的独立 Field 组件：<schema-form-string> 等，可单独使用
 * ✅ 字段容器带类名：schema-form-item schema-type-xxx，并带 data-path="a.b.0.c"
 * ✅ schema-form-array 支持条目上下移动
 * ✅ 主类为泛型：SchemaForm<T>
 * ✅ 提供 createSchemasteryForm<T>() 工厂，返回带强类型的 FormInstance<T>
 *
 * @license MIT
 * @author dragon-fish
 * @author @openai/gpt-5
 */

import type Schema from 'schemastery'
import BASE_STYLE from './style.scss?inline'

// ---------------------------------------------------------------------------
// i18n 配置
// ---------------------------------------------------------------------------
export interface SchemaFormI18n {
  arrayAdd?: string
  arrayMoveUp?: string
  arrayMoveDown?: string
  arrayRemove?: string
  dictAdd?: string
  dictRemove?: string
  rootLabel?: string
}
export const DEFAULT_I18N: Required<SchemaFormI18n> = {
  arrayAdd: '+',
  arrayMoveUp: '↑',
  arrayMoveDown: '↓',
  arrayRemove: '×',
  dictAdd: '+',
  dictRemove: '×',
  rootLabel: 'root',
}

// ---------------------------------------------------------------------------
// 类型与工具
// ---------------------------------------------------------------------------
export type JSONValue = string | number | boolean | null | JSONValue[] | { [k: string]: JSONValue }
// 导出类型定义
export interface SchemaFormChangeDetail<T = any> {
  path: (string | number)[]
  value: any
  state: T
}
export type SchemaFormChangeEvent<T = any> = Event & {
  detail: SchemaFormChangeDetail<T>
}

// 注册 Custom Element（避免重复注册报错）
const registerCustomElement = (name: string, ctor: CustomElementConstructor) => {
  if (!customElements.get(name)) customElements.define(name, ctor)
}

// 路径工具
type PathSeg = string | number
const getByPath = (obj: any, path: PathSeg[]): any => path.reduce((o, k) => o?.[k], obj)
const setByPath = (obj: any, path: PathSeg[], value: any): void => {
  if (!path.length) return
  let cursor: any = obj
  let parent: any = null
  let parentKey: any = null
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    let next = cursor?.[key]

    // 如果中间节点不存在，按下一段类型创建
    if (next == null) {
      next = typeof path[i + 1] === 'number' ? [] : {}
      cursor[key] = next
    } else if (typeof next !== 'object') {
      // 如果出现了原始值（string / number / boolean 等），但后面仍有路径，需要“升级”成容器
      next = typeof path[i + 1] === 'number' ? [] : {}
      cursor[key] = next
    }

    parent = cursor
    parentKey = key
    cursor = next
  }

  const lastKey = path[path.length - 1]

  // 若最终 cursor 仍是原始值（极端情况：path 只有一段且 obj 本身是原始值），做一次容器升级
  if (cursor == null || typeof cursor !== 'object') {
    const replacement = typeof lastKey === 'number' ? [] : {}
    if (parent) {
      parent[parentKey] = replacement
      cursor = replacement
    } else {
      // parent 不存在说明 obj 自身不是对象，直接返回不赋值以避免抛错
      return
    }
  }

  try {
    cursor[lastKey] = value
  } catch (err) {
    // 最后一层仍然不可写（比如被 Object.freeze），尝试替换成浅拷贝后再写
    try {
      const cloned = Array.isArray(cursor) ? cursor.slice() : { ...cursor }
      cloned[lastKey] = value
      if (parent) parent[parentKey] = cloned
    } catch {
      // 静默失败，避免打断用户输入
    }
  }
}
const dotPath = (path: PathSeg[]) => path.map(String).join('.')

// ✅ 用于生成稳定的 id/name（label for 依赖 id）
const sanitizeForId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_')
const idOf = (path: PathSeg[]) => `schema_${sanitizeForId(dotPath(path) || 'root')}`
const nameOf = (path: PathSeg[]) => dotPath(path)

// 值转换（input -> 目标类型）
function castToType(type: string, value: any) {
  if (value == null) return value
  switch (type) {
    case 'number':
    case 'natural':
    case 'percent': {
      if (value === '') return undefined
      const num = Number(value)
      return Number.isNaN(num) ? undefined : num
    }
    case 'boolean':
      return Boolean(value)
    case 'date': {
      if (!value) return undefined
      const d = new Date(value)
      return Number.isNaN(+d) ? undefined : d
    }
    case 'const':
    case 'string':
    default:
      return value
  }
}

// ---------------------------------------------------------------------------
// Schemastery 实例识别/构建（带泛型）
// ---------------------------------------------------------------------------
function isSchemaInstance<T = any>(input: any): input is Schema<T> {
  return typeof input === 'function' && !!input?.type
}
function ensureSchemaInstance<T = any>(input: any): Schema<T> {
  if (!input) throw new Error('schema is required')
  if (isSchemaInstance<T>(input)) return input
  try {
    // @ts-ignore
    const inst = Schema.from(input)
    if (isSchemaInstance<T>(inst)) return inst
  } catch {}
  if (input?.type) {
    const t = input.type
    // @ts-ignore
    if ((Schema as any)[t]) return (Schema as any)[t](input.inner ?? input.list ?? input.dict)
  }
  throw new Error('无法从传入对象生成 Schemastery 实例，请传入 schema 或 schema.toJSON() 的结果。')
}

function metaOf(schema: any): any {
  return schema?.meta ?? {}
}
function unionIsEnum(list: any[]): boolean {
  return list.length > 0 && list.every((s) => s?.type === 'const')
}
function defaultOf<T = any>(schema: Schema<T>): T {
  if (!schema) return undefined as unknown as T
  const anySchema: any = schema as any
  const meta = anySchema.meta || {}
  // 优先 meta.default
  if (Object.prototype.hasOwnProperty.call(meta, 'default')) return meta.default as T
  const type = anySchema.type
  // 某些场景下直接调用 schema() 可返回默认值
  try {
    const direct = schema()
    if (direct !== undefined) return direct as T
  } catch {}
  switch (type) {
    case 'string':
      return '' as unknown as T
    case 'number':
    case 'natural':
    case 'percent':
      return 0 as unknown as T
    case 'boolean':
      return false as unknown as T
    case 'array':
      return [] as unknown as T
    case 'tuple':
      return [] as unknown as T
    case 'object':
      return {} as unknown as T
    case 'dict':
      return {} as unknown as T
    case 'union': {
      const list = anySchema.list || []
      if (list.length) return defaultOf(list[0]) as T
      return undefined as unknown as T
    }
    case 'const':
      return anySchema.value as T
    case 'date':
      return undefined as unknown as T
    default:
      return undefined as unknown as T
  }
}

// ---------------------------------------------------------------------------
// 字段基础类（供各 schema-form-* 继承） —— 泛型化：值类型 T 绑定到 Schema<T>
// ---------------------------------------------------------------------------
abstract class BaseFieldElement<T = any> extends HTMLElement {
  /** Schemastery 子 schema（泛型） */ protected _schema!: Schema<T>
  /** 字段路径（用于 data-path 与事件）*/ protected _path: PathSeg[] = []
  /** 当前值（UI 原始值）*/ protected _value!: T
  /** ShadowRoot */ protected $root: ShadowRoot
  /** 显示标签 */ protected _label?: string
  /** i18n 文本 */ protected _i18n = DEFAULT_I18N

  constructor() {
    super()
    this.$root = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = BASE_STYLE
    this.$root.appendChild(style)
  }

  /** 初始化公共容器（带类名与 data-path） */
  protected makeFieldContainer(typeClass: string, description?: string) {
    const $field = document.createElement('div')
    $field.className = `field schema-form-item schema-type-${typeClass}`
    $field.setAttribute('data-path', dotPath(this._path))
    if (this._label) {
      const $label = document.createElement('label')
      $label.className = 'label'
      $label.textContent = this._label
      $field.appendChild($label)
    }
    if (description) {
      const $desc = document.createElement('div')
      $desc.className = 'helper'
      $desc.textContent = description
      $field.appendChild($desc)
    }
    return $field
  }

  /** 外部设置 schema/path/label/value */
  set schema(v: Schema<T>) {
    this._schema = ensureSchemaInstance<T>(v as any)
    this.render()
  }
  get schema() {
    return this._schema
  }
  set path(p: PathSeg[]) {
    this._path = p ?? []
    this.render()
  }
  get path() {
    return this._path
  }
  set label(v: string | undefined) {
    this._label = v
    this.render()
  }
  get label() {
    return this._label
  }
  set i18n(v: Partial<SchemaFormI18n> | undefined) {
    if (v) this._i18n = { ...this._i18n, ...v }
    this.render()
  }
  get i18n() {
    return this._i18n
  }
  setValue(v: T) {
    this._value = v as T
    this.render()
  }
  getValue(): T {
    return this._value
  }

  /** 子类实现具体渲染 */
  protected abstract render(): void

  /** 触发变更事件（冒泡） */
  protected emitChange(value: T) {
    this._value = value
    this.dispatchEvent(
      new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail: { path: this._path, value },
      })
    )
  }
}

// ---------------------------------------------------------------------------
// 具体字段实现：string / number / boolean / date / const —— 泛型绑定
// ---------------------------------------------------------------------------
class SchemaFormString extends BaseFieldElement<string | undefined> {
  private $input?: HTMLInputElement

  protected render() {
    // 如果已经有输入框，只更新值而不重新创建
    if (this.$input && this.$root.contains(this.$input)) {
      const currentValue = (this._value ?? '') as string
      if (this.$input.value !== currentValue && document.activeElement !== this.$input) {
        this.$input.value = currentValue
      }
      return
    }

    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('string', meta.description)
    const $input = document.createElement('input')
    this.$input = $input
    $input.className = 'input'
    $input.type = 'text'
    $input.name = nameOf(this._path)
    $input.id = idOf(this._path)
    if (meta?.pattern?.source) $input.pattern = meta.pattern.source
    if (meta?.max != null) $input.maxLength = meta.max
    $input.value = (this._value ?? '') as any
    $input.oninput = () => this.emitChange(castToType('string', $input.value) as any)
    const $label = $field.querySelector('label.label') as HTMLLabelElement | null
    if ($label) $label.htmlFor = $input.id
    $field.appendChild($input)
    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-string', SchemaFormString)

class SchemaFormNumber extends BaseFieldElement<number | undefined> {
  private $input?: HTMLInputElement

  protected render() {
    // 如果已经有输入框，只更新值而不重新创建
    if (this.$input && this.$root.contains(this.$input)) {
      const currentValue = (this._value ?? '') as any
      if (this.$input.value !== String(currentValue) && document.activeElement !== this.$input) {
        this.$input.value = currentValue
      }
      return
    }

    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const t = (this._schema as any)?.type ?? 'number'
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('number', meta.description)
    const $input = document.createElement('input')
    this.$input = $input
    $input.className = 'input'
    $input.name = nameOf(this._path)
    $input.id = idOf(this._path)
    if (meta?.min != null) $input.min = String(meta.min)
    if (meta?.max != null) $input.max = String(meta.max)
    if (meta?.step != null) $input.step = String(meta.step)
    if (t === 'percent' && !$input.step) $input.step = '0.01'
    $input.value = (this._value ?? '') as any
    $input.oninput = () => this.emitChange(castToType(t, $input.value) as any)
    const $label = $field.querySelector('label.label') as HTMLLabelElement | null
    if ($label) $label.htmlFor = $input.id

    if (meta.role === 'slider') {
      $input.type = 'range'
    } else {
      $input.type = 'number'
    }

    $field.appendChild($input)
    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-number', SchemaFormNumber)

class SchemaFormBoolean extends BaseFieldElement<boolean> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('boolean', meta.description)
    const $box = document.createElement('label')
    $box.className = 'checkbox'
    const $input = document.createElement('input')
    $input.type = 'checkbox'
    $input.checked = Boolean(this._value)
    $input.name = nameOf(this._path)
    $input.id = idOf(this._path)
    const $txt = document.createElement('span')
    $txt.textContent = meta.description ?? this._label ?? ''
    $input.onchange = () => this.emitChange($input.checked)
    const $label = $field.querySelector('label.label') as HTMLLabelElement | null
    if ($label) $label.htmlFor = $input.id
    $box.append($input, $txt)
    $field.appendChild($box)
    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-boolean', SchemaFormBoolean)

// 日期/时间格式化工具：统一生成符合 <input> 期望的字符串
function pad2(n: number) {
  return String(n).padStart(2, '0')
}
function formatDate(d: Date) {
  // 注意：这里返回的字符串用于 <input type="date">，浏览器会将其视为本地日期而不做时区转换。
  // 不应使用 d.toISOString().slice(0,10) —— 那样会把本地日期转换成 UTC 造成跨时区偏移。
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
function formatDateTimeLocal(d: Date) {
  return `${formatDate(d)}T${formatTime(d)}`
}

class SchemaFormDate extends BaseFieldElement<Date | undefined> {
  private $input?: HTMLInputElement

  protected render() {
    // 如果已经有输入框，只更新值而不重新创建
    if (this.$input && this.$root.contains(this.$input)) {
      const meta = metaOf(this._schema)
      const role = meta.role || 'date'
      if (document.activeElement !== this.$input) {
        if (this._value instanceof Date) {
          if (role === 'date') this.$input.value = formatDate(this._value)
          else if (role === 'time') this.$input.value = formatTime(this._value)
          else if (role === 'datetime') this.$input.value = formatDateTimeLocal(this._value)
        } else if (typeof this._value === 'string' && role !== 'time') {
          const d = new Date(this._value)
          if (!isNaN(+d)) {
            if (role === 'date') this.$input.value = formatDate(d)
            else if (role === 'datetime') this.$input.value = formatDateTimeLocal(d)
          }
        } else if (!this._value) {
          this.$input.value = ''
        }
      }
      return
    }

    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('date', meta.description)
    const $input = document.createElement('input')
    this.$input = $input
    $input.className = 'input'
    const role = meta.role || 'date'
    if (role === 'datetime') $input.type = 'datetime-local'
    else if (role === 'time') $input.type = 'time'
    else $input.type = 'date'
    $input.name = nameOf(this._path)
    $input.id = idOf(this._path)
    if (this._value instanceof Date) {
      if (role === 'date') {
        // 使用本地日期格式，不受时区偏移影响
        $input.value = formatDate(this._value)
      } else if (role === 'time') $input.value = formatTime(this._value)
      else if (role === 'datetime') $input.value = formatDateTimeLocal(this._value)
    } else if (typeof this._value === 'string' && role !== 'time') {
      const d = new Date(this._value)
      if (!isNaN(+d)) {
        if (role === 'date') $input.value = formatDate(d)
        else if (role === 'datetime') $input.value = formatDateTimeLocal(d)
      }
    }
    $input.oninput = () => {
      const role = meta.role || 'date'
      let next: Date | undefined
      if (!$input.value) {
        next = undefined
      } else {
        // date 或 datetime-local: 浏览器 value 可以被 new Date() 解析（标准格式）
        const d = new Date($input.value)
        next = Number.isNaN(+d) ? undefined : d
      }
      this.emitChange(next as any)
    }
    const $label = $field.querySelector('label.label') as HTMLLabelElement | null
    if ($label) $label.htmlFor = $input.id
    $field.appendChild($input)
    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-date', SchemaFormDate)

class SchemaFormConst extends BaseFieldElement<any> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const value = (this._schema as any).value

    if (meta.role === 'raw-html') {
      if (value instanceof Node) {
        this.$root.appendChild(value)
        return
      }

      const htmlNode = document.createElement('div')
      htmlNode.innerHTML = String(value)
      this.$root.appendChild(htmlNode)
      return
    }

    const $field = this.makeFieldContainer('const', meta.description)
    const $text = document.createElement('section')
    $text.className = 'const content'
    $text.textContent = String(value)
    $text.id = idOf(this._path)
    const $label = $field.querySelector('label.label') as HTMLLabelElement | null
    if ($label) $label.htmlFor = $text.id
    $field.appendChild($text)
    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-const', SchemaFormConst)

// ---------------------------------------------------------------------------
// 复杂字段：union / tuple / object / array / dict —— 泛型辅助
// ---------------------------------------------------------------------------
function tagForSchema(schema: Schema<any>): keyof HTMLElementTagNameMap {
  const t = (schema as any).type
  switch (t) {
    case 'string':
      return 'schema-form-string' as any
    case 'number':
    case 'natural':
    case 'percent':
      return 'schema-form-number' as any
    case 'boolean':
      return 'schema-form-boolean' as any
    case 'date':
      return 'schema-form-date' as any
    case 'const':
      return 'schema-form-const' as any
    case 'array':
      return 'schema-form-array' as any
    case 'object':
      return 'schema-form-object' as any
    case 'tuple':
      return 'schema-form-tuple' as any
    case 'dict':
      return 'schema-form-dict' as any
    case 'union': {
      const list: any[] = (schema as any).list || []
      // For Schema.date(), it will be transformed into:
      // 1) transform(inner:string meta.role=datetime)
      // 2) union[ is(Date), transform(inner:string meta.role=datetime) ]
      if (
        list.length === 2 &&
        list[0]?.type === 'is' &&
        list[0]?.constructor === Date &&
        list[1]?.type === 'transform' &&
        (list[1]?.inner?.meta?.role === 'datetime' ||
          list[1]?.inner?.meta?.role === 'date' ||
          list[1]?.inner?.meta?.role === 'time')
      ) {
        return 'schema-form-date' as any
      } else {
        return 'schema-form-union' as any
      }
    }
    default:
      return 'schema-form-string' as any
  }
}

function createFieldForSchema<T>(
  schema: Schema<T>,
  path: PathSeg[],
  value: T,
  label?: string,
  i18n?: Partial<SchemaFormI18n>
): HTMLElement {
  const tag = tagForSchema(schema)
  const el = document.createElement(tag) as any
  el.schema = schema as Schema<T>
  el.path = path
  el.label = label
  if (i18n) el.i18n = i18n
  el.setValue?.(value)
  return el
}

class SchemaFormUnion extends BaseFieldElement<any> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('union', meta.description)
    const list = (this._schema as any).list || []

    if (unionIsEnum(list)) {
      const $select = document.createElement('select')
      $select.className = 'input'
      $select.name = nameOf(this._path)
      $select.id = idOf(this._path)
      list.forEach((s: any) => {
        const opt = document.createElement('option')
        opt.value = String(s.value)
        opt.textContent = String(s.meta?.description || s.value || s.type)
        if (this._value === s.value) opt.selected = true
        $select.appendChild(opt)
      })
      $select.onchange = () => this.emitChange(castToType('string', $select.value))
      const $label = $field.querySelector('label.label') as HTMLLabelElement | null
      if ($label) $label.htmlFor = $select.id
      $field.appendChild($select)
    } else {
      const $toolbar = document.createElement('div')
      $toolbar.className = 'toolbar'
      const $select = document.createElement('select')
      $select.className = 'input'
      $select.name = nameOf(this._path) + '.__type'
      $select.id = idOf(this._path) + '__type'
      let active = 0
      ;(list as any[]).forEach((s: any, i: number) => {
        const opt = document.createElement('option')
        opt.value = String(i)
        opt.textContent = String(s.meta?.description || s.value || s.type)
        $select.appendChild(opt)
      })
      $select.onchange = () => {
        active = Number($select.value)
        const sub = list[active]
        const next = defaultOf(sub)
        this.emitChange(next)
        renderChild()
      }
      const $label = $field.querySelector('label.label') as HTMLLabelElement | null
      if ($label) $label.htmlFor = $select.id
      $toolbar.appendChild($select)
      $field.appendChild($toolbar)

      const $box = document.createElement('div')
      $box.className = 'group'
      const renderChild = () => {
        $box.innerHTML = ''
        const current = list[active]
        const child = createFieldForSchema(current, this._path, this._value, this._label)
        if (child instanceof SchemaFormConst) {
          return // 不用渲染常量
        }
        child.addEventListener('change', (e: any) => {
          e.stopPropagation() // ✅ 不让子项事件继续冒泡
          this.emitChange(e.detail.value)
        })
        $box.appendChild(child)
      }
      renderChild()
      $field.appendChild($box)
    }

    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-union', SchemaFormUnion)

class SchemaFormTuple extends BaseFieldElement<any[]> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('tuple', meta.description)
    const $box = document.createElement('div')
    $box.className = 'group'

    const arr: any[] = Array.isArray(this._value) ? this._value : []
    ;((this._schema as any).list || []).forEach((sub: any, i: number) => {
      const child = createFieldForSchema(
        sub,
        [...this._path, i],
        arr[i],
        `${this._label ?? ''}[${i}]`
      )
      child.addEventListener('change', (e: any) => {
        e.stopPropagation() // ✅
        const base = Array.isArray(this._value) ? this._value.slice() : []
        base[i] = e.detail.value
        this.emitChange(base)
      })
      $box.appendChild(child)
    })
    $field.appendChild($box)
    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-tuple', SchemaFormTuple)

class SchemaFormObject extends BaseFieldElement<Record<string, any>> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('object', meta.description)
    const $box = document.createElement('div')
    $box.className = 'group'
    const dict = (this._schema as any).dict || {}

    Object.keys(dict).forEach((k) => {
      if (dict[k]?.meta?.hidden) return
      const current = (this._value ?? {})[k]
      const child = createFieldForSchema(dict[k], [...this._path, k], current, k)
      child.addEventListener('change', (e: any) => {
        e.stopPropagation() // ✅
        const base = { ...(this._value ?? {}) }
        base[k] = e.detail.value
        this.emitChange(base)
      })
      $box.appendChild(child)
    })
    $field.appendChild($box)
    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-object', SchemaFormObject)

class SchemaFormArray extends BaseFieldElement<any[]> {
  // 稳定 ID（与索引解耦）用于 FLIP 动画
  private _itemIds: string[] = []
  private static _idCounter = 0
  private generateItemId() {
    try {
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
        return (crypto as any).randomUUID()
      }
    } catch {}
    return 'i' + SchemaFormArray._idCounter++
  }
  private ensureItemIds(len: number) {
    while (this._itemIds.length < len) this._itemIds.push(this.generateItemId())
    if (this._itemIds.length > len) this._itemIds.length = len
  }

  // 采集当前行位置信息（用于 FLIP）
  private capturePositions($box: HTMLElement): Record<string, DOMRect> {
    const map: Record<string, DOMRect> = {}
    $box.querySelectorAll<HTMLElement>('.row').forEach((row) => {
      const id = row.dataset.uid
      if (id) map[id] = row.getBoundingClientRect()
    })
    return map
  }
  private playFLIP($box: HTMLElement, before: Record<string, DOMRect>) {
    const rows = Array.from($box.querySelectorAll<HTMLElement>('.row'))
    rows.forEach((row) => {
      const id = row.dataset.uid
      if (!id) return
      const prev = before[id]
      if (!prev) return
      const now = row.getBoundingClientRect()
      const dx = prev.left - now.left
      const dy = prev.top - now.top
      if (dx || dy) {
        row.style.transition = 'none'
        row.style.transform = `translate(${dx}px, ${dy}px)`
        // 下一帧播放动画
        requestAnimationFrame(() => {
          row.style.transition = 'transform .25s ease'
          row.style.transform = ''
        })
      }
    })
  }

  protected render() {
    // 基础样式（数组动画相关样式已迁移至 style.scss）
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('array', meta.description)
    const $box = document.createElement('div')
    $box.className = 'group'

    const innerSchema = (this._schema as any).inner!
    const currentList = () => (Array.isArray(this._value) ? this._value : [])
    this.ensureItemIds(currentList().length)

    const renderRows = (before?: Record<string, DOMRect>, addedId?: string) => {
      $box.innerHTML = ''
      const list = currentList()
      list.forEach((item, idx) => {
        const rowPath = [...this._path, idx]
        const row = document.createElement('div')
        row.className = 'row schema-collection-row'
        const stableId = this._itemIds[idx]
        row.dataset.uid = stableId
        row.setAttribute('data-path', dotPath(rowPath))

        const child = createFieldForSchema(
          innerSchema,
          rowPath,
          item,
          `${this._label ?? ''}[${idx}]`
        )
        child.addEventListener('change', (e: any) => {
          e.stopPropagation()
          const base = currentList().slice()
          base[idx] = e.detail.value
          this._value = base
          // 仅值更新，不触发重渲，避免输入框失焦；结构变化（增删/移动）才重渲
          this.emitChange(base)
        })

        const toolbar = document.createElement('div')
        toolbar.className = 'actions'

        // 上移
        const up = document.createElement('button')
        up.type = 'button'
        up.className = 'btn'
        up.textContent = this._i18n.arrayMoveUp ?? '↑'
        up.onclick = () => {
          if (idx <= 0) return
          const beforePos = this.capturePositions($box)
          const base = currentList().slice()
          ;[base[idx - 1], base[idx]] = [base[idx], base[idx - 1]]
          ;[this._itemIds[idx - 1], this._itemIds[idx]] = [
            this._itemIds[idx],
            this._itemIds[idx - 1],
          ]
          this._value = base
          renderRows(beforePos)
          this.emitChange(base)
        }

        // 下移
        const down = document.createElement('button')
        down.type = 'button'
        down.className = 'btn'
        down.textContent = this._i18n.arrayMoveDown ?? '↓'
        down.onclick = () => {
          const now = currentList()
          if (idx >= now.length - 1) return
          const beforePos = this.capturePositions($box)
          const base = now.slice()
          ;[base[idx + 1], base[idx]] = [base[idx], base[idx + 1]]
          ;[this._itemIds[idx + 1], this._itemIds[idx]] = [
            this._itemIds[idx],
            this._itemIds[idx + 1],
          ]
          this._value = base
          renderRows(beforePos)
          this.emitChange(base)
        }

        // 删除
        const del = document.createElement('button')
        del.type = 'button'
        del.className = 'btn danger'
        del.textContent = this._i18n.arrayRemove ?? '×'
        del.onclick = () => {
          // 离场动画：不立即更新 state，先让该行缩放淡出
          row.classList.add('leaving')
          const duration = 250
          let done = false
          const cleanup = () => {
            if (done) return
            done = true
            clearTimeout(fallback)
            const base = currentList().filter((_, i) => i !== idx)
            this._itemIds.splice(idx, 1)
            const beforePos = this.capturePositions($box) // 采集剩余行位置（删除前）
            this._value = base
            renderRows(beforePos)
            this.emitChange(base)
          }
          row.addEventListener('transitionend', cleanup, { once: true })
          // 兜底：防止某些环境下 transition 事件不触发
          const fallback = setTimeout(cleanup, duration + 80)
        }

        toolbar.append(up, down, del)
        row.appendChild(child)
        row.appendChild(toolbar)
        $box.appendChild(row)

        // 新增行入场动画
        if (addedId && addedId === stableId) {
          row.classList.add('enter')
          requestAnimationFrame(() => {
            row.classList.add('enter-active')
          })
          // 在第二帧移除 enter class（保持 enter-active 最终状态即可）
          requestAnimationFrame(() => {
            row.classList.remove('enter')
          })
        }
      })

      if (before) this.playFLIP($box, before)
    }

    // 初始渲染
    renderRows()

    // 新增
    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'btn primary'
    add.textContent = this._i18n.arrayAdd ?? '+'
    add.onclick = () => {
      const beforePos = this.capturePositions($box)
      const base = currentList().slice()
      const newItem = defaultOf(innerSchema)
      base.push(newItem)
      const newId = this.generateItemId()
      this._itemIds.push(newId)
      this._value = base
      renderRows(beforePos, newId)
      this.emitChange(base)
    }

    const actions = document.createElement('div')
    actions.className = 'actions'
    actions.appendChild(add)

    $field.appendChild($box)
    $field.appendChild(actions)
    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-array', SchemaFormArray)

class SchemaFormDict extends BaseFieldElement<Record<string, any>> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('dict', meta.description)
    const $box = document.createElement('div')
    $box.className = 'group'

    const innerSchema = (this._schema as any).inner!
    const map: Record<string, any> = this._value ?? {}

    // 为 dict 条目分配稳定 ID
    const keys = Object.keys(map)
    // 将稳定 ID 存放在临时映射（保存在 element dataset 中即可）
    const ensureId = (k: string) => `d_${k}` // 以 key 直接生成，若重命名再更新

    const capturePositions = (): Record<string, DOMRect> => {
      const pos: Record<string, DOMRect> = {}
      $box.querySelectorAll<HTMLElement>('.kv').forEach((row) => {
        const uid = row.dataset.uid
        if (uid) pos[uid] = row.getBoundingClientRect()
      })
      return pos
    }
    const playFLIP = (before: Record<string, DOMRect>) => {
      $box.querySelectorAll<HTMLElement>('.kv').forEach((row) => {
        const uid = row.dataset.uid
        if (!uid) return
        const prev = before[uid]
        if (!prev) return
        const now = row.getBoundingClientRect()
        const dx = prev.left - now.left
        const dy = prev.top - now.top
        if (dx || dy) {
          row.style.transition = 'none'
          row.style.transform = `translate(${dx}px, ${dy}px)`
          requestAnimationFrame(() => {
            row.style.transition = 'transform .25s ease'
            row.style.transform = ''
          })
        }
      })
    }

    const renderRows = (before?: Record<string, DOMRect>, addedKey?: string) => {
      $box.innerHTML = ''
      Object.keys(map).forEach((k) => {
        const rowPath = [...this._path, k]
        const row = document.createElement('div')
        row.className = 'kv schema-collection-row'
        row.dataset.uid = ensureId(k)
        row.setAttribute('data-path', dotPath(rowPath))
        const $k = document.createElement('input')
        $k.className = 'input'
        $k.value = k
        $k.name = nameOf(rowPath) + '.__key'
        $k.id = idOf(rowPath) + '__key'
        const $v = createFieldForSchema(innerSchema, rowPath, map[k], `${this._label ?? ''}[${k}]`)

        const $del = document.createElement('button')
        $del.type = 'button'
        $del.className = 'btn danger'
        $del.textContent = this._i18n.dictRemove ?? '×'
        $del.onclick = () => {
          const beforePos = capturePositions()
          delete map[k]
          const base = { ...(this._value ?? {}) }
          delete base[k]
          this._value = base
          renderRows(beforePos)
          this.emitChange(base)
        }

        $k.onchange = () => {
          const nv = $k.value.trim()
          if (!nv || nv === k || map[nv] !== undefined) return
          const beforePos = capturePositions()
          map[nv] = map[k]
          delete map[k]
          const base = { ...(this._value ?? {}) }
          base[nv] = base[k]
          delete base[k]
          this._value = base
          renderRows(beforePos)
          this.emitChange(base)
        }

        $v.addEventListener('change', (e: any) => {
          e.stopPropagation()
          const base = { ...(this._value ?? {}) }
          base[k] = e.detail.value
          this._value = base
          this.emitChange(base)
        })

        row.append($k, $v, $del)
        $box.appendChild(row)

        if (addedKey === k) {
          row.classList.add('enter')
          requestAnimationFrame(() => row.classList.add('enter-active'))
          requestAnimationFrame(() => row.classList.remove('enter'))
        }
      })
      if (before) playFLIP(before)
    }

    renderRows()

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'btn primary'
    add.textContent = this._i18n.dictAdd ?? '+'
    add.onclick = () => {
      // 生成不冲突的 key
      let idx = Object.keys(map).length + 1
      let keyName = `k${idx}`
      while (map[keyName] !== undefined) keyName = `k${++idx}`
      const beforePos = capturePositions()
      map[keyName] = defaultOf(innerSchema)
      const base = { ...(this._value ?? {}), [keyName]: map[keyName] }
      this._value = base
      renderRows(beforePos, keyName)
      this.emitChange(base)
    }
    const actions = document.createElement('div')
    actions.className = 'actions'
    actions.appendChild(add)

    $field.appendChild($box)
    $field.appendChild(actions)
    this.$root.appendChild($field)
  }
}
registerCustomElement('schema-form-dict', SchemaFormDict)

// ---------------------------------------------------------------------------
// 主表单元素：<schema-form> —— 已为泛型 SchemaForm<T>
// ---------------------------------------------------------------------------
export class SchemaForm<T extends any = unknown> extends HTMLElement {
  private _schema!: Schema<T>
  private _state: any
  private $root: ShadowRoot
  private _i18n: Required<SchemaFormI18n> = { ...DEFAULT_I18N }
  constructor() {
    super()
    this.$root = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = BASE_STYLE
    this.$root.appendChild(style)
    const wrap = document.createElement('div')
    wrap.className = 'wrapper'
    wrap.innerHTML = `<form class="form" part="form"></form>`
    this.$root.appendChild(wrap)

    // 冒泡捕获字段变更
    this.addEventListener('change', (e: any) => {
      if (!e?.detail) return
      const { path, value } = e.detail

      if (Array.isArray(path) && path.length === 0) {
        // ✅ 允许根对象整体替换
        this._state = value
      } else {
        setByPath(this._state ?? (this._state = {}), path, value)
      }

      this.dispatchEvent(
        new CustomEvent('form-change', { detail: { path, value, state: this._state } })
      )
    })
  }

  // --- 对外 API ---
  set schema(value: Schema<T>) {
    this._schema = ensureSchemaInstance<T>(value as any)
    // ✅ 深默认初始化（autofix）
    try {
      this._state = this._schema(null as any, { autofix: true })
    } catch {
      this._state = defaultOf<T>(this._schema)
    }
    this.render()
  }
  get schema() {
    return this._schema
  }
  set schemaJSON(value: JSONValue) {
    this.schema = value as any
  }
  get schemaJSON(): any {
    return (this._schema as any)?.toJSON?.()
  }

  setData(
    data: Partial<T>,
    opts: { validate?: boolean; autofix?: boolean } = { validate: true, autofix: true }
  ) {
    if (!this._schema) throw new Error('请先设置 schema')
    const value = opts.validate
      ? this._schema((data as T) ?? null, { autofix: opts.autofix })
      : (data as any)
    this._state = value
    this.render()
  }
  getData(opts: { validate?: boolean; autofix?: boolean } = { validate: true, autofix: true }): T {
    if (!this._schema) throw new Error('请先设置 schema')
    const raw = this._state
    return opts.validate ? this._schema(raw ?? null, { autofix: opts.autofix }) : (raw as T)
  }
  reset() {
    try {
      this._state = this._schema(null as any, { autofix: true })
    } catch {
      this._state = defaultOf<T>(this._schema)
    }
    this.render()
  }
  refresh() {
    this.render()
  }

  // i18n 相关
  set i18n(v: Partial<SchemaFormI18n>) {
    this._i18n = { ...this._i18n, ...v }
    this.render()
  }
  get i18n() {
    return this._i18n
  }

  private render() {
    if (!this._schema) return
    const form = this.$root.querySelector('form')!
    form.innerHTML = ''
    const child = createFieldForSchema<T>(
      this._schema,
      [],
      this._state as T,
      this._i18n.rootLabel,
      this._i18n
    )
    form.appendChild(child)
  }
}
registerCustomElement('schema-form', SchemaForm)

// ---------------------------------------------------------------------------
// createSchemasteryForm<T>() —— 强类型工厂
// ---------------------------------------------------------------------------
export interface FormInstance<T> {
  /** 底层元素 */ el: SchemaForm<T>
  /** 挂载 */ mount: (parent: HTMLElement | string) => SchemaForm<T>
  /** 设置数据（可选校验）*/ setData: (v: Partial<T>, opts?: { validate?: boolean }) => void
  /** 获取数据（默认校验）*/ getData: (opts?: { validate?: boolean }) => T
  /** 卸载/清理 */ destroy: () => void
}

/**
 * 创建一个带强类型提示的 Schemastery 表单实例。
 * @param schema Schemastery schema（函数调用返回 T）
 * @param options 初始值与 onChange 回调
 */
export function createSchemasteryForm<T = any>(
  schema: Schema<T>,
  options?: { value?: Partial<T>; onChange?: (val: T) => void; i18n?: Partial<SchemaFormI18n> }
): FormInstance<T> {
  const el = document.createElement('schema-form') as SchemaForm<T>
  el.schema = schema
  if (options?.i18n) el.i18n = options.i18n
  if (options?.value) el.setData(options.value)
  const onChange = options?.onChange
  const handler = () => {
    try {
      onChange?.(el.getData())
    } catch {}
  }
  if (onChange) el.addEventListener('form-change', handler)
  return {
    el,
    mount: (parent) => {
      if (typeof parent === 'string') {
        const p = document.querySelector(parent)
        if (!p) throw new Error('未找到挂载节点：' + parent)
        p.innerHTML = ''
        p.appendChild(el)
      }
      if (parent instanceof HTMLElement) {
        parent.innerHTML = ''
        parent.appendChild(el)
      } else {
        throw new Error('挂载节点必须是 HTMLElement 或 选择器字符串')
      }
      return el
    },
    setData: (v, opts) => el.setData(v, opts),
    getData: (opts?: { validate?: boolean }) => el.getData(opts as any) as T,
    destroy: () => {
      if (onChange) el.removeEventListener('form-change', handler)
      el.remove()
    },
  }
}

export function install() {
  registerCustomElement('schema-form', SchemaForm)
  registerCustomElement('schema-form-string', SchemaFormString)
  registerCustomElement('schema-form-number', SchemaFormNumber)
  registerCustomElement('schema-form-boolean', SchemaFormBoolean)
  registerCustomElement('schema-form-date', SchemaFormDate)
  registerCustomElement('schema-form-const', SchemaFormConst)
  registerCustomElement('schema-form-union', SchemaFormUnion)
  registerCustomElement('schema-form-tuple', SchemaFormTuple)
  registerCustomElement('schema-form-object', SchemaFormObject)
  registerCustomElement('schema-form-array', SchemaFormArray)
  registerCustomElement('schema-form-dict', SchemaFormDict)
}

// ---------------------------------------------------------------------------
// 全局类型声明（便于 TS 推断）
// ---------------------------------------------------------------------------
declare global {
  interface HTMLElementTagNameMap {
    'schema-form': SchemaForm
    'schema-form-string': SchemaFormString
    'schema-form-number': SchemaFormNumber
    'schema-form-boolean': SchemaFormBoolean
    'schema-form-date': SchemaFormDate
    'schema-form-const': SchemaFormConst
    'schema-form-union': SchemaFormUnion
    'schema-form-tuple': SchemaFormTuple
    'schema-form-object': SchemaFormObject
    'schema-form-array': SchemaFormArray
    'schema-form-dict': SchemaFormDict
  }
}
