## Why

用户在不离开鼠标的情况下无法发现和触发命令。当前 Ctrl+P 命令面板功能完整但需要快捷键，侧边栏提供了鼠标交互区域却没有命令搜索能力。

## What Changes

- 侧边栏顶部新增搜索输入框
- 搜索框集成 `useCommandDialog()` 的 `visibleOptions()` 命令数据源
- 使用 fuzzysort 实现模糊搜索（复用 DialogSelect 的搜索逻辑）
- 搜索结果按 category 分组展示（仿 Ctrl+P 命令面板布局）
- 空搜索时侧边栏显示正常内容 + 模板折叠区
- 键入时内容区切换为搜索结果
- 点击结果直接执行命令（`command.trigger()`）
- Esc 清空搜索框恢复侧边栏原内容

## Capabilities

### New Capabilities
- `sidebar-command-search`: 侧边栏命令搜索 UI 与交互

### Modified Capabilities

- (none)

## Impact

- `src/cli/cmd/tui/routes/session/sidebar.tsx`: 新增搜索框组件
- `src/cli/cmd/tui/component/dialog-command.tsx`: 暴露命令列表供搜索复用
- 复用现有的 `fuzzysort`、`useCommandDialog()`、`DialogSelect` 分类展示模式
