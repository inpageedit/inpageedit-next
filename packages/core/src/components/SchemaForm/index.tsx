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

import Schema from 'schemastery'
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

// 路径工具
type PathSeg = string | number
const getByPath = (obj: any, path: PathSeg[]): any => path.reduce((o, k) => o?.[k], obj)
const setByPath = (obj: any, path: PathSeg[], value: any): void => {
  if (!path.length) return
  let cursor = obj
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    if (cursor[key] == null) cursor[key] = typeof path[i + 1] === 'number' ? [] : {}
    cursor = cursor[key]
  }
  cursor[path[path.length - 1]] = value
}
const dotPath = (path: PathSeg[]) => path.map(String).join('.')

// ✅ 用于生成稳定的 id/name（label for 依赖 id）
const sanitizeForId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_')
const idOf = (path: PathSeg[]) => `schema_${sanitizeForId(dotPath(path) || 'root')}`
const nameOf = (path: PathSeg[]) => dotPath(path)

// 简单 uid（如需临时唯一标识可用）
const uid = (() => {
  let i = 0
  return () => (++i).toString(36)
})()

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
if (!customElements.get('schema-form-string')) {
  customElements.define('schema-form-string', SchemaFormString)
}

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
    $input.type = 'number'
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
    $field.appendChild($input)
    this.$root.appendChild($field)
  }
}
if (!customElements.get('schema-form-number')) {
  customElements.define('schema-form-number', SchemaFormNumber)
}

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
    $txt.textContent = this._label ?? ''
    $input.onchange = () => this.emitChange($input.checked)
    const $label = $field.querySelector('label.label') as HTMLLabelElement | null
    if ($label) $label.htmlFor = $input.id
    $box.append($input, $txt)
    $field.appendChild($box)
    this.$root.appendChild($field)
  }
}
if (!customElements.get('schema-form-boolean')) {
  customElements.define('schema-form-boolean', SchemaFormBoolean)
}

class SchemaFormDate extends BaseFieldElement<Date | undefined> {
  private $input?: HTMLInputElement

  protected render() {
    // 如果已经有输入框，只更新值而不重新创建
    if (this.$input && this.$root.contains(this.$input)) {
      const currentDate = (this._value ?? null) as Date | null
      if (document.activeElement !== this.$input) {
        this.$input.valueAsDate = currentDate
      }
      return
    }

    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('date', meta.description)
    const $input = document.createElement('input')
    this.$input = $input
    $input.className = 'input'
    $input.type = 'date'
    $input.name = nameOf(this._path)
    $input.id = idOf(this._path)
    $input.valueAsDate = (this._value ?? null) as any
    $input.oninput = () => this.emitChange(castToType('date', $input.value) as any)
    const $label = $field.querySelector('label.label') as HTMLLabelElement | null
    if ($label) $label.htmlFor = $input.id
    $field.appendChild($input)
    this.$root.appendChild($field)
  }
}
if (!customElements.get('schema-form-date')) {
  customElements.define('schema-form-date', SchemaFormDate)
}

class SchemaFormConst extends BaseFieldElement<any> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('const', meta.description)
    const $ro = document.createElement('input')
    $ro.className = 'input'
    $ro.readOnly = true
    $ro.value = String((this._schema as any).value)
    $ro.name = nameOf(this._path)
    $ro.id = idOf(this._path)
    const $label = $field.querySelector('label.label') as HTMLLabelElement | null
    if ($label) $label.htmlFor = $ro.id
    $field.appendChild($ro)
    this.$root.appendChild($field)
  }
}
if (!customElements.get('schema-form-const')) {
  customElements.define('schema-form-const', SchemaFormConst)
}

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
    case 'union':
      return 'schema-form-union' as any
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
        opt.textContent = String(s.value)
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
        opt.textContent = s.type
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
        child.addEventListener('change', (e: any) => this.emitChange(e.detail.value))
        $box.appendChild(child)
      }
      renderChild()
      $field.appendChild($box)
    }

    this.$root.appendChild($field)
  }
}
if (!customElements.get('schema-form-union')) {
  customElements.define('schema-form-union', SchemaFormUnion)
}

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
        const copy = arr.slice()
        copy[i] = e.detail.value
        this.emitChange(copy)
      })
      $box.appendChild(child)
    })
    $field.appendChild($box)
    this.$root.appendChild($field)
  }
}
if (!customElements.get('schema-form-tuple')) {
  customElements.define('schema-form-tuple', SchemaFormTuple)
}

class SchemaFormObject extends BaseFieldElement<Record<string, any>> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('object', meta.description)
    const $box = document.createElement('div')
    $box.className = 'group'
    const obj = this._value ?? {}
    const dict = (this._schema as any).dict || {}
    Object.keys(dict).forEach((k) => {
      if (dict[k]?.meta?.hidden) return
      const child = createFieldForSchema(dict[k], [...this._path, k], obj[k], k)
      child.addEventListener('change', (e: any) => {
        const copy = { ...obj }
        copy[k] = e.detail.value
        this.emitChange(copy)
      })
      $box.appendChild(child)
    })
    $field.appendChild($box)
    this.$root.appendChild($field)
  }
}
if (!customElements.get('schema-form-object')) {
  customElements.define('schema-form-object', SchemaFormObject)
}

class SchemaFormArray extends BaseFieldElement<any[]> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('array', meta.description)
    const $box = document.createElement('div')
    $box.className = 'group'
    const list: any[] = Array.isArray(this._value) ? this._value : []

    const renderRows = () => {
      $box.innerHTML = ''
      list.forEach((item, idx) => {
        const rowPath = [...this._path, idx]
        const row = document.createElement('div')
        row.className = 'row'
        row.setAttribute('data-path', dotPath(rowPath))
        const child = createFieldForSchema(
          (this._schema as any).inner!,
          rowPath,
          item,
          `${this._label ?? ''}[${idx}]`
        )
        child.addEventListener('change', (e: any) => {
          list[idx] = e.detail.value
          this.emitChange(list.slice())
        })
        const toolbar = document.createElement('div')
        toolbar.className = 'actions'
        const up = document.createElement('button')
        up.type = 'button'
        up.className = 'btn'
        up.textContent = this._i18n.arrayMoveUp ?? '↑'
        const down = document.createElement('button')
        down.type = 'button'
        down.className = 'btn'
        down.textContent = this._i18n.arrayMoveDown ?? '↓'
        const del = document.createElement('button')
        del.type = 'button'
        del.className = 'btn danger'
        del.textContent = this._i18n.arrayRemove ?? '×'
        up.onclick = () => {
          if (idx > 0) {
            const t = list[idx - 1]
            list[idx - 1] = list[idx]
            list[idx] = t
            renderRows()
            this.emitChange(list.slice())
          }
        }
        down.onclick = () => {
          if (idx < list.length - 1) {
            const t = list[idx + 1]
            list[idx + 1] = list[idx]
            list[idx] = t
            renderRows()
            this.emitChange(list.slice())
          }
        }
        del.onclick = () => {
          list.splice(idx, 1)
          renderRows()
          this.emitChange(list.slice())
        }
        toolbar.append(up, down, del)
        row.appendChild(child)
        row.appendChild(toolbar)
        $box.appendChild(row)
      })
    }

    renderRows()

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'btn primary'
    add.textContent = this._i18n.arrayAdd ?? '+'
    add.onclick = () => {
      list.push(defaultOf((this._schema as any).inner!))
      renderRows()
      this.emitChange(list.slice())
    }
    const actions = document.createElement('div')
    actions.className = 'actions'
    actions.appendChild(add)

    $field.appendChild($box)
    $field.appendChild(actions)
    this.$root.appendChild($field)
  }
}
if (!customElements.get('schema-form-array')) {
  customElements.define('schema-form-array', SchemaFormArray)
}

class SchemaFormDict extends BaseFieldElement<Record<string, any>> {
  protected render() {
    this.$root.innerHTML = `<style>${BASE_STYLE}</style>`
    const meta = metaOf(this._schema)
    const $field = this.makeFieldContainer('dict', meta.description)
    const $box = document.createElement('div')
    $box.className = 'group'
    const map: Record<string, any> = this._value ?? {}

    Object.keys(map).forEach((k) => {
      const rowPath = [...this._path, k]
      const row = document.createElement('div')
      row.className = 'kv'
      row.setAttribute('data-path', dotPath(rowPath))
      const $k = document.createElement('input')
      $k.className = 'input'
      $k.value = k
      $k.name = nameOf(rowPath) + '.__key'
      $k.id = idOf(rowPath) + '__key'
      const $v = createFieldForSchema(
        (this._schema as any).inner!,
        rowPath,
        map[k],
        `${this._label ?? ''}[${k}]`
      )
      const $del = document.createElement('button')
      $del.type = 'button'
      $del.className = 'btn danger'
      $del.textContent = this._i18n.dictRemove ?? '×'
      $del.onclick = () => {
        delete map[k]
        this.emitChange({ ...map })
      }
      $k.onchange = () => {
        const nv = $k.value
        if (!nv || nv === k) return
        const copy = { ...map }
        copy[nv] = copy[k]
        delete copy[k]
        this.emitChange(copy)
      }
      $v.addEventListener('change', (e: any) => {
        const copy = { ...map }
        copy[k] = e.detail.value
        this.emitChange(copy)
      })
      row.append($k, $v, $del)
      $box.appendChild(row)
    })

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'btn primary'
    add.textContent = this._i18n.dictAdd ?? '+'
    add.onclick = () => {
      const keyName = `k${Object.keys(map).length + 1}`
      const next = defaultOf((this._schema as any).inner!)
      const copy = { ...map, [keyName]: next }
      this.emitChange(copy)
    }
    const actions = document.createElement('div')
    actions.className = 'actions'
    actions.appendChild(add)

    $field.appendChild($box)
    $field.appendChild(actions)
    this.$root.appendChild($field)
  }
}
if (!customElements.get('schema-form-dict')) {
  customElements.define('schema-form-dict', SchemaFormDict)
}

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
      setByPath(this._state ?? (this._state = {}), path, value)
      this.dispatchEvent(
        new CustomEvent('form-change', { detail: { path, value, state: this._state } })
      )
    })
  }

  // --- 对外 API ---
  set schema(value: Schema<T>) {
    this._schema = ensureSchemaInstance<T>(value as any)
    this._state = defaultOf<T>(this._schema)
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
    this._state = defaultOf<T>(this._schema)
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
if (!customElements.get('schema-form')) {
  customElements.define('schema-form', SchemaForm)
}

// ---------------------------------------------------------------------------
// createSchemasteryForm<T>() —— 强类型工厂
// ---------------------------------------------------------------------------
export interface FormInstance<T> {
  /** 底层元素 */ el: SchemaForm<T>
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
    setData: (v, opts) => el.setData(v, opts),
    getData: (opts?: { validate?: boolean }) => el.getData(opts as any) as T,
    destroy: () => {
      if (onChange) el.removeEventListener('form-change', handler)
      el.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// 全局类型声明（便于 TS 推断）
// ---------------------------------------------------------------------------
declare global {
  interface HTMLElementTagNameMap {
    'schema-form': SchemaForm<any>
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
