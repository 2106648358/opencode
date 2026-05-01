## Context

template-engine 变更提供了模板数据层（从 git 仓库解析出结构化模板），sidebar-command-search 变更提供了侧边栏搜索 UI。本变更负责将二者连接：让模板出现在命令搜索中，并提供变量填充对话框和 prompt 插入机制。

## Goals / Non-Goals

**Goals:**
- 模板引擎解析出的模板自动注册为 `CommandOption`（`category: "Templates"`）
- 模板命令包含 `slash` 属性，可在 prompt 中通过 `/` 补全
- 点击模板（侧边栏/Ctrl+P/prompt `/`）→ 检查是否有 `variables`
- 有变量 → 弹出变量填充对话框；无变量 → 直接插入
- 变量填充对话框列出所有 `variables`，每个变量一个输入框
- 填充后替换 `{{variable}}` 占位符，通过 `TuiEvent.PromptAppend` 插入 prompt

**Non-Goals:**
- 不在 TUI 中编辑/删除模板（模板管理在 git 仓库中完成）
- 不实现模板变量默认值或自动预填（留给后续迭代）
- 不修改模板引擎的数据结构

## Decisions

| 决策 | 选择 | 替代方案 |
|------|------|----------|
| 注册时机 | 模板引擎加载完成后，遍历模板列表调用 `command.register()` | 模板引擎直接返回 CommandOption 数组（分离更清晰） |
| 命令 value 格式 | `template:<filename>` (e.g. `template:explain-code`) | 直接用文件名（可能冲突） |
| 变量对话框 | 新建独立 Dialog 组件 `DialogTemplateFill`，复用 dialog 弹层机制 | inline 表单（侧边栏内空间不够） |
| 无变量模板 | 直接 `TuiEvent.PromptAppend` 插入 body | 弹空对话框（多此一举） |
| 变量表单布局 | 每个 variable 一行：`name  [input]`，description 作为 placeholder | 复杂布局（42 字符放不下） |

## Risks / Trade-offs

- [变量对话框破坏输入流] → 对话框模式（modal），填充前用户不能操作 prompt，逻辑清晰
- [模板很多时命令列表膨胀] → category 分组天然隔离，"Templates" 组在 Ctrl+P 中可被搜索过滤
- [依赖 template-engine 和 sidebar-command-search] → 这两个变更必须先完成或并行开发
