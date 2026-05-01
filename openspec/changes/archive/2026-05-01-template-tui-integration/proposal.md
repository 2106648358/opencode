## Why

模板引擎（template-engine）提供了数据层，但用户需要一个直观的界面来浏览模板、填写变量并插入到对话中。同时模板应该和现有命令系统融合，既能通过 Ctrl+P 搜索，也能在侧边栏点击，还能在 prompt 中用 `/` 补全。

## What Changes

- 模板解析后注册为 `CommandOption`（`category: "Templates"`，含 `slash` 属性）
- 模板命令注册到 `useCommandDialog()`，同时出现在 Ctrl+P 和 `/` 补全中
- 实现变量填充对话框：点击模板后弹出，列出所有 `variables` 让用户填写
- 变量填充后替换 `{{variable}}` 占位符
- 通过 `TuiEvent.PromptAppend` 将替换后的文本插入 prompt 输入框
- 侧边栏 Templates 折叠区显示模板列表，点击直接进入填充对话框

## Capabilities

### New Capabilities
- `template-ui`: 模板的 TUI 交互层，包含命令注册、变量填充对话框、prompt 插入

### Modified Capabilities

- (none, 依赖 template-engine 和 sidebar-command-search 的能力)

## Impact

- `src/cli/cmd/tui/`: 新增变量填充对话框组件
- `src/cli/cmd/tui/plugin/api.tsx`: 模板命令注册逻辑
- `src/cli/cmd/tui/component/prompt/`: PromptAppend 事件使用
- `src/cli/cmd/tui/feature-plugins/sidebar/`: 新增 templates 侧边栏插件
- 依赖 template-engine 和 sidebar-command-search 变更
