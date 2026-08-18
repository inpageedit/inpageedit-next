# 插件中心规范

本文档定义了 InPageEdit 插件中心（Plugin Store）的数据规范，供插件开发者和插件中心平台参考使用。

## 插件包结构

::: details Schema

<<< ./plugin-store.schema.json

:::

## 插件中心注册商示例

以下是一个插件中心注册商（Plugin Store Registry）的示例，展示了如何使用上述规范来定义一个插件中心。

文件结构

```
root/
├── index.json                    # 插件中心索引数据
└── plugins/
    ├── plugin-a/
    │   ├── src/                  # 插件 A 的源代码
    │   ├── dist/                 # 插件 A 的构建产物
    │   └── ...
    ├── plugin-b/
    │   ├── src/                  # 插件 B 的源代码
    │   ├── dist/                 # 插件 B 的构建产物
    │   └── ...
    └── ...
```

::: details index.json 示例

<<< ./registry.sample.json

:::
