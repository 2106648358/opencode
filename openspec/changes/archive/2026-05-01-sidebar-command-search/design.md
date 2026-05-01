## Context

侧边栏当前是 42 字符宽的固定面板，通过 slot 系统渲染内容。命令系统通过 `useCommandDialog()` 上下文管理，提供 `visibleOptions()`、`slashes()`、`trigger()` 等接口。`DialogSelect` 组件已经实现了 fuzzysort 搜索 + category 分组展示，可直接复用其模式。

## Goals / Non-Goals

**Goals:**
- 侧边栏顶部常驻搜索输入框（42 字符宽度内）
- 搜索源为 `useCommandDialog().visibleOptions()`（所有非隐藏命令）
- 使用 fuzzysort 模糊搜索（按 title 权重大于 category）
- 搜索结果按 category 分组展示（仿 DialogSelect 布局）
- 空搜索时侧边栏显示正常内容（模板折叠区 + MCP + Files 等）
- 键入时内容区切换为搜索结果列表
- 点击/回车结果 → `command.trigger(value)` 执行命令
- Esc 或清空输入 → 恢复侧边栏原内容

**Non-Goals:**
- 不修改 DialogSelect 或 Ctrl+P 命令面板的行为
- 不实现侧边栏内容的过滤/搜索（只搜命令，不搜 MCP/TODO 等状态信息）
- 不支持鼠标悬停预览（TUI 能力限制）

## Decisions

| 决策 | 选择 | 替代方案 |
|------|------|----------|
| 搜索框位置 | 侧边栏顶部，sidebar_title 之下、sidebar_content 之上 | sidebar_footer 区域（不直觉） |
| 搜索实现 | 嵌入 fuzzysort，复用 DialogSelect 的分组逻辑 | 复用 DialogSelect 组件本身（太重，上下文不匹配） |
| 状态切换 | 空/键入两态：空→显示侧边栏，非空→显示搜索结果 | 全屏叠加层（丢失侧边栏上下文） |
| 输入框风格 | 与 DialogSelect 的 input 样式一致 | 自定义样式（不一致） |
| 数据流 | 消费 `useCommandDialog().visibleOptions()` | 单独维护命令列表（不同步） |

## Risks / Trade-offs

- [42 字符宽度不足] → 搜索结果显示 title 即可，description 在 footer 区域截断展示
- [键入时侧边栏内容切换可能闪烁] → SolidJS 的 createMemo 确保切换平滑
- [与 Ctrl+P 命令面板体验重叠] → 设计定位为鼠标场景的补充，不是替代
