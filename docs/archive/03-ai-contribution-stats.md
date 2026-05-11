# AI 贡献统计系统

## 概述

全面集成 AI 代码贡献统计系统，对标 [ai-credit](https://github.com/debugtheworldbot/ai-credit) 的完整功能：自动统计 AI 助手产生的代码行数，按模型/文件/时间维度展示，支持行级验证。

## 架构

```
用户输入 /stats 或 Ctrl+K → "AI Contribution Stats"
        │
        ▼
DialogAIStats 弹窗
        │
        ▼
sync.data.contrib ← GET /experimental/contrib/stats
                     │
                     ├── session 表 → 会话 + summary_additions/deletions/files/diffs
                     ├── message 表 → 第一个 user 消息的 modelID
                     ├── git ls-files → 仓库文件列表 + 总行数
                     └── diff 行级验证 → AI 写的行是否仍在当前代码中
```

## API

### `GET /experimental/contrib/stats`

**路径**: `packages/opencode/src/server/routes/instance/experimental.ts`

**响应结构**:

```json
{
  "sessions": 12,
  "added": 1023,
  "deleted": 211,
  "files": 42,
  "totalLines": 42500,
  "aiContributedLines": 1234,
  "byModel": [
    { "model": "claude-sonnet-4", "sessions": 8, "added": 823, "deleted": 156 }
  ],
  "topFiles": [
    { "file": "src/auth/login.ts", "added": 342, "deleted": 12, "totalLines": 804, "aiLines": 342, "ratio": 0.425 }
  ],
  "recentSessions": [
    { "id": "01J...", "title": "Fix login", "time": 1746880000, "model": "claude-sonnet-4", "added": 342, "deleted": 12 }
  ]
}
```

### 后端核心函数

**位置**: `packages/opencode/src/session/session.ts` → `getContribStats(projectID, worktree?)`

```typescript
export function* getContribStats(projectID: ProjectID, worktree?: string)
```

执行流程：
1. 查询 DB：`SELECT * FROM session WHERE project_id = ? AND parent_id IS NULL`
2. 查询 DB：每个 session 的 message（提取第一个 user 消息的 modelID）
3. 逐 session 遍历 `summary_diffs`，按排除规则过滤
4. 如果 `worktree` 提供，执行仓库扫描：
   - `git -C <worktree> ls-files -z`（已跟踪文件）
   - `git -C <worktree> ls-files --others --exclude-standard -z`（未跟踪文件）
   - `fs.readFileSync` 统计每个文件行数
5. 行级验证：解析 unified diff 提取 AI 加的行 → whitespace-normalized 匹配当前文件内容

## 排除规则

**位置**: `packages/opencode/src/session/session.ts` 顶部

```typescript
// TODO: make exclusion patterns configurable via .opencode/config.yaml or openspecignore
const EXCLUDED_PREFIXES = ["spec/", "openspec/", ".openspec/"]
const isExcluded = (file: string) => EXCLUDED_PREFIXES.some((p) => file.startsWith(p))
```

当前硬编码，TODO 标记后续从配置文件读取。

## 行级验证

匹配模式：`relaxed`（whitespace-normalized）：

```typescript
function parseDiffAddedLines(patch: string): string[] {
  // 解析 unified diff，提取 + 开头的行（排除 +++）
  // whitespace-normalized + trim，去重
}

// 验证：从文件读取当前内容，split("\n")，whitespace-normalized，Set 判存
for (const aiLine of f.aiLineContents) {
  if (currentLines.has(aiLine)) aiVerified++
}
```

## 前端

### 弹窗组件

**位置**: `packages/opencode/src/cli/cmd/tui/component/dialog-ai-stats.tsx`

布局（自定义 Dialog，非 DialogSelect）：

```
Dialog (88 列宽)
└── box height={65vh}
    ├── Title: "AI Contribution Report"
    ├── scrollbox (可滚动)
    │   ├── Overview     : Sessions / Added / Deleted / Files / Net
    │   ├── AI Contribution : Repo Lines / AI Lines / AI Ratio %
    │   ├── By Model     : 每模型 +added/-deleted sessions + 条形图
    │   ├── Top Files    : 每文件 +added/-deleted ratio% + 条形图
    │   └── Recent Sessions : 时间 / 标题 / 变更 / 模型
    └── Footer: "Esc to close"
```

### 数据流

**位置**: `packages/opencode/src/cli/cmd/tui/context/sync.tsx`

- `sync.data.contrib` 字段：`object | null`
- 启动时 `bootstrap()` 中 fetch
- `session.updated` 事件时自动刷新

## 目录

| 位置 | 文件 |
|------|------|
| 后端 API | `src/server/routes/instance/experimental.ts` |
| 后端核心 | `src/session/session.ts` `getContribStats()` |
| 前端弹窗 | `src/cli/cmd/tui/component/dialog-ai-stats.tsx` |
| 前端 sync | `src/cli/cmd/tui/context/sync.tsx` |
| 命令注册 | `src/cli/cmd/tui/app.tsx` |
| 参照项目 | `D:\ProjectWorkbench\ai-credit-main` |
