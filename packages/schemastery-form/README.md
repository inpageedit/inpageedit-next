# schemastery-form

> 🧩 基于 [Schemastery](https://github.com/shigma/schemastery) 的零依赖 Schema → 表单 Web Components 生成器。
>
> 使用原生 Custom Elements (`<schema-form>` 等) 自动根据 Schemastery Schema 渲染交互式表单，可独立运行，也可无缝集成到任意框架 (Vue / React / Svelte / 纯静态页面)。

<p align="center">
  <img src="https://img.shields.io/npm/v/schemastery-form?color=42b883&label=schemastery-form" alt="npm version" />
  <img src="https://img.shields.io/npm/l/schemastery-form" alt="license" />
  <img src="https://img.shields.io/badge/webcomponents-%E2%9C%94-brightgreen" alt="wc" />
  <img src="https://img.shields.io/badge/typescript-%E2%9C%94-blue" alt="ts" />
</p>

## ✨ 特性

- ✅ 纯 Web Components：无需框架运行时，开箱即用！
- ✅ TypeScript 强类型：`createSchemasteryForm<T>()` 返回带泛型的实例
- ✅ 支持 Schemastery 常见类型：`string / number / boolean / date / const / object / array / tuple / dict / union`
- ✅ 每种类型都有对应独立组件：`<schema-form-string>`、`<schema-form-array>` 等，可单独使用
- ✅ 双向数据同步：实时触发表单变更事件 `form-change`
- ✅ 支持 i18n：简单传入文案覆盖
- ✅ 默认值 / autofix 支持，深层初始化
- ✅ 提供工厂 API、Imperative 使用方式
- ✅ 简洁样式，支持通过 `--schema-*` CSS 变量自定义主题
- ✅ UMD / ESM 双构建，支持直接 `<script>` 引入 或打包工具
- ✅ 疯狂的打包体积，比官方版 schemastery-vue 迷你超多：`dist/index.js 22.60 kB │ gzip: 5.95 kB`

## 📦 安装

```bash
pnpm add schemastery schemastery-form
# 或 npm / yarn
npm i schemastery schemastery-form
```

> 注意：`schemastery` 与（可选的）`vue` 为 peer 依赖，请确保外部已安装。

## 🚀 快速开始

### 1. 准备一个 Schemastery Schema

```ts
import Schema from 'schemastery'
import { createSchemasteryForm } from 'schemastery-form'

const UserSchema = Schema.object({
  name: Schema.string().description('昵称'),
  age: Schema.number().min(0).description('年龄'),
  tags: Schema.array(Schema.string()).description('标签'),
  profile: Schema.object({
    website: Schema.string().description('个人站点'),
    active: Schema.boolean().description('是否活跃'),
  }),
  role: Schema.union([
    Schema.const('admin'),
    Schema.const('user'),
    Schema.const('guest'),
  ]).description('角色'),
})
```

### 2. 创建并挂载表单

```ts
const form = createSchemasteryForm(UserSchema, {
  value: { name: 'Alice', tags: ['a'] },
  onChange(val) {
    console.log('最新表单值', val)
  },
  i18n: { rootLabel: '用户配置' },
})

form.mount('#my-form-container')
```

### 3. 获取 / 设置数据

```ts
// 获取（默认会再次通过 schema 验证）
const data = form.getData() // => User 类型

// 设置（可关闭验证）
form.setData({ age: 20 }, { validate: false })

// 重置
form.el.reset()
```

### 4. 也可以直接使用 `<schema-form>` 标签

```html
<script type="module">
  import Schema from 'schemastery'
  import 'schemastery-form'

  const schema = Schema.object({ msg: Schema.string().description('消息') })
  const el = document.querySelector('schema-form')
  el.schema = schema
  el.setData({ msg: 'Hi' })
  el.addEventListener('form-change', (e) => console.log(e.detail.state))
</script>

<!-- 或者直接这样，很酷！ -->
<schema-form></schema-form>
```

## 🧩 组件一览

| Schema 类型                | 组件标签                | 说明                             |
| -------------------------- | ----------------------- | -------------------------------- |
| string                     | `<schema-form-string>`  | 文本输入                         |
| number / natural / percent | `<schema-form-number>`  | 数字输入，percent 自动 step=0.01 |
| boolean                    | `<schema-form-boolean>` | 复选框                           |
| date                       | `<schema-form-date>`    | 日期输入（`<input type=date>`）  |
| const                      | `<schema-form-const>`   | 只读常量显示                     |
| array                      | `<schema-form-array>`   | 列表，支持上下移动 / 删除 / 添加 |
| object                     | `<schema-form-object>`  | 对象键值，逐字段渲染             |
| tuple                      | `<schema-form-tuple>`   | 固定长度序列                     |
| dict                       | `<schema-form-dict>`    | 动态键值对，可编辑 key           |
| union                      | `<schema-form-union>`   | 下拉或子 schema 选择             |

> 也可直接手动创建对应组件并赋值它们的 `schema / path / label / setValue()`。

## 🔧 API 说明

### createSchemasteryForm

```ts
function createSchemasteryForm<T>(
  schema: Schema<T>,
  options?: {
    value?: Partial<T>
    onChange?: (val: T) => void
    i18n?: Partial<SchemaFormI18n>
  }
): FormInstance<T>
```

返回对象：

```ts
interface FormInstance<T> {
  el: SchemaForm<T>
  setData(v: Partial<T>, opts?: { validate?: boolean }): void
  getData(opts?: { validate?: boolean }): T
  destroy(): void
}
```

### `<schema-form>` 实例属性 / 方法

| 属性/方法              | 类型                                                      | 说明                                              |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `schema`               | `Schema<T>`                                               | 设置表单 Schema（会重建默认值）                   |
| `schemaJSON`           | `any`                                                     | 传入 `schema.toJSON()` 结果亦可（内部会尝试恢复） |
| `setData(data, opts?)` | `(Partial<T>, { validate?: boolean; autofix?: boolean })` | 设置数据                                          |
| `getData(opts?)`       | `(opts?) => T`                                            | 获取（可关验证）                                  |
| `reset()`              | `() => void`                                              | 重置为默认值 (autofix)                            |
| `refresh()`            | `() => void`                                              | 强制重新渲染                                      |
| `i18n`                 | `SchemaFormI18n`                                          | 文案覆盖                                          |

### 事件

| 事件名        | 触发时机       | `detail`         |
| ------------- | -------------- | ---------------- | ---------------------------------- |
| `form-change` | 任意子字段修改 | `{ path: (string | number)[], value: any, state: T }` |

> `path` 为空数组时表示根结构被整体替换（如 union 切换）。

## 🌐 i18n 文案

```ts
interface SchemaFormI18n {
  arrayAdd?: string
  arrayMoveUp?: string
  arrayMoveDown?: string
  arrayRemove?: string
  dictAdd?: string
  dictRemove?: string
  rootLabel?: string
}
```

默认值：

```ts
{
  arrayAdd: '+',
  arrayMoveUp: '↑',
  arrayMoveDown: '↓',
  arrayRemove: '×',
  dictAdd: '+',
  dictRemove: '×',
  rootLabel: 'root'
}
```

使用：

```ts
form.el.i18n = { arrayAdd: '添加', rootLabel: '配置' }
```

## 🎨 自定义样式 (CSS Variables)

所有组件都带有基本类名：`schema-form-item` + `schema-type-${type}`。

可用 CSS 变量（示例，实际请查看源码 `style.scss`）：

```css
schema-form {
  --schema-font-family: ui-sans-serif, system-ui;
  --schema-color-fg: #222;
  --schema-color-border: #dcdfe6;
  --schema-radius: 6px;
  --schema-color-accent: #42b883;
}
```

也可以通过 ::part / Shadow pierce（目前只暴露 `form` part）：

```css
schema-form::part(form) {
  max-width: 640px;
}
```

## 🧪 使用单个字段组件

```html
<schema-form-string id="field"></schema-form-string>
<script type="module">
  import Schema from 'schemastery'
  import 'schemastery-form'

  const el = document.getElementById('field')
  el.schema = Schema.string().pattern(/^[a-z]+$/)
  el.path = ['user', 'name']
  el.label = '用户名'
  el.setValue('bob')
  el.addEventListener('change', (e) => console.log(e.detail))
</script>
```

## 🔌 Vue 集成

> 你其实可以直接在 Vue 里用 `<schema-form>`，不过我们提供了一个具有双向绑定的预封装组件。
>
> 对了，差点忘记告诉你，它也超级迷你：`dist/vue.js 2.72 kB │ gzip: 1.14 kB`

```vue
<script setup lang="ts">
import Schema from 'schemastery'
import SchemasteryForm from 'schemastery-form/vue'
import { ref, onMounted, useTemplateRef } from 'vue'

interface Todo {
  title: string
  done: boolean
}

const schema = ref(
  new Schema<Todo>(Schema.object({ title: Schema.string(), done: Schema.boolean() }))
)
const value = ref<Todo>({ title: '', done: false })
const formRef = useTemplateRef('formRef')

function onChange(val: any) {
  console.log('表单值变更', val)
}
</script>

<template>
  <SchemasteryForm ref="formRef" :schema="schema" v-model:value="value" @change="onChange" />
  <pre>{{ value }}</pre>
</template>
```

## 其他框架集成

> 其实你也可以直接在 React / Svelte 里用 `<schema-form>`，不过我们还没有提供预封装组件。

PRs welcome!

## 🧭 Roadmap

- [ ] 校验错误可视化（红框 / message）
- [ ] 支持自定义渲染器注入（slot / registry）
- [ ] 更丰富的日期 / 选择器增强（datetime / select widget）
- [ ] 联动表达式（根据其它字段状态动态隐藏/禁用）
- [ ] README 英文版

## 🤝 贡献

欢迎 PR / Issue！开发：

```bash
pnpm i
pnpm dev
```

---

> MIT License
>
> Copyright © 2025 dragon-fish
