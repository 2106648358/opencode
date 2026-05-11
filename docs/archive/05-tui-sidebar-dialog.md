# TUI 侧边栏与弹窗 UX

## 侧边栏

**位置**: `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`

### 最终布局

```
┌─────────────────────────┐
│ Sessions              3 │
│─────────────────────────│
│ > Fix login   14:30     │  ← 激活态用 ">" 前缀
│ Add dark mode 13:15    │
│ Refactor API  Yesterday │
│                         │
│─────────────────────────│
│ OpenCode 1.14.28        │
└─────────────────────────┘
```

### 设计点

- **激活标识**：使用 `>` 前缀代替 `◼` 或背景色，简洁且不依赖颜色
- **单行布局**：标题 + 日期同行显示，`overflow: hidden` 处理长标题
- **工作中指示**：`...` 动画，显示在行尾
- **无图标**：去掉了所有 Unicode 装饰字符（◼ ⟳ ■ □）
- **无分隔线**：去掉 session 之间的分隔线

### 移除的功能

原先的 AI Stats 区块已从侧边栏移除，移到独立的弹窗中。

| 功能 | 旧位置 | 新位置 |
|------|--------|--------|
| 会话统计摘要 | 侧边栏底部 | `dialog-ai-stats.tsx` |
| Top 文件排行 | 侧边栏展开 | `dialog-ai-stats.tsx` |

## 弹窗 Dialog 布局

**位置**: `packages/opencode/src/cli/cmd/tui/ui/dialog.tsx`

### Dialog 组件结构

```tsx
// 全屏遮罩
<box width={screenW} height={screenH} paddingTop={screenH/4} alignItems="center">
  // 内容区（宽度固定 60/88/116 列）
  <box width={size}>
    {props.children}
  </box>
</box>
```

`paddingTop={screenH/4}` 提供顶部偏移，`alignItems="center"` 水平居中。

### AI Stats 弹窗布局

所有内容放在有显式高度约束的容器内，避免溢出：

```tsx
<Dialog size="large">
  <box flexDirection="column" height={dimensions().height * 0.65}>
    <box flexShrink={0}>Title</box>
    <scrollbox flexGrow={1}>
      {/* 所有内容，超出滚动 */}
    </scrollbox>
    <box flexShrink={0}>Footer (Esc to close)</box>
  </box>
</Dialog>
```

关键属性：
- `height={screenH * 0.65}`：显式高度，配合 `paddingTop=25%`，在 75% 屏幕高度内容纳 65% 的内容
- `scrollbox flexGrow={1}`：中间区域占满剩余空间，溢出可滚动
- 标题/底栏 `flexShrink={0}`：始终固定可见，不滚动

## Autocomplete 修复

**位置**: `packages/opencode/src/cli/cmd/tui/component/prompt/autocomplete.tsx:405`

### 问题

TUI 的 `/` 命令 autocomplete 显式过滤了 `source === "skill"` 的命令：

```typescript
// 原代码 line 405
if (serverCommand.source === "skill") continue
```

导致所有以 skill 方式注册的命令（包括内置 openspec 命令）不在 `/` 补全中显示。

### 修复

删除该行，所有命令（无论 source）都出现在 `/` 补全中。

### 命令注册来源

| Source | 来源 | 补全显示 |
|--------|------|:--------:|
| `"command"` | `.opencode/commands/*.md`、`command/index.ts` 硬编码 | ✓ |
| `"mcp"` | MCP server prompts | ✓ |
| `"skill"` | `.opencode/skills/*/SKILL.md`、`BUILTIN_SKILLS` | ✓（原 ✗） |
