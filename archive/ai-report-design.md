# AI 贡献率本地报告 — 设计文档

## 需求背景

当前 `ai_diff` 表已持久化每次 AI 工具调用的 per-file diff 数据，但缺少两个关键环节：

1. **贡献率计算**：尚未实现 AI diff 与 git diff 的对比算法
2. **本地即时报告**：只在 CI 时统计 master 会导致与本地实际贡献率偏差较大

本方案在本地 commit 时即时计算 AI 贡献率，并将结果持久化到数据库，后续可通过远程数据库同步供 CI 查询，确保本地与 CI 数据一致。

## 状态机

```
┌─────────┐    commit     ┌───────────┐    push to     ┌────────┐
│ pending  │ ──────────→  │ committed │ ───────────→   │ synced │
│ (AI生成) │  post-commit │ (已提交)   │  remote DB    │ (已同步) │
└─────────┘               └───────────┘                └────────┘
```

- **pending**：AI 生成代码，记录写入 `ai_diff`，尚未匹配到任何 git commit
- **committed**：post-commit hook 运行后，AI diff 与 commit diff 匹配成功，写入 `commit_hash`
- **synced**：数据已推送到远程数据库，CI 可直接查询

所有状态存储在 SQLite 数据库中，不依赖文件系统级别状态。

## Schema 变更

### `ai_diff` 表新增列

```sql
ALTER TABLE ai_diff ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE ai_diff ADD COLUMN commit_hash TEXT;
ALTER TABLE ai_diff ADD COLUMN committed_at INTEGER;
CREATE INDEX ai_diff_lifecycle_idx ON ai_diff(lifecycle);
CREATE INDEX ai_diff_commit_hash_idx ON ai_diff(commit_hash);
```

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `lifecycle` | TEXT | `'pending'` | `pending` → `committed` → `synced` |
| `commit_hash` | TEXT | NULL | 关联的 git commit SHA |
| `committed_at` | INTEGER | NULL | commit 发生时间戳（ms） |

现有 `status` 列（`added`/`deleted`/`modified`）保持不变 — 它描述文件级别的操作类型，与生命周期正交。

### 新表 `ai_commit_report`

```sql
CREATE TABLE ai_commit_report (
  commit_hash     TEXT PRIMARY KEY,
  branch          TEXT NOT NULL,
  total_additions INTEGER NOT NULL,
  ai_additions    INTEGER NOT NULL,
  ai_rate         REAL NOT NULL,
  file_breakdown  TEXT NOT NULL,  -- JSON
  session_ids     TEXT NOT NULL,  -- JSON array
  model_breakdown TEXT NOT NULL,  -- JSON
  created_at      INTEGER NOT NULL
);
CREATE INDEX ai_commit_report_branch_idx ON ai_commit_report(branch);
CREATE INDEX ai_commit_report_created_at_idx ON ai_commit_report(created_at);
```

## 匹配算法：行级交集 + 去重上限

采用行级交集而非 hunk 上下文匹配，原因是用户可能在 AI 生成后手动调整代码（插入行、删除行、移动代码块），hunk 边界会漂移导致失配。行级交集对代码移动和局部修改有天然容忍度。

```
computeFileOverlap(gitDiff, aiDiffs):
  gitLines  = extractAddedLines(gitDiff)       // 语义 +行 列表
  aiLineSet = new Set(aiDiffs.flatMap(extractAddedLines))  // 去重

  aiCount = 0
  for line in gitLines:
    if aiLineSet.has(line):
      aiCount++
      aiLineSet.delete(line)   // 防止高频重复行膨胀 AI 率

  return { aiCount, total: gitLines.length }
```

**去重删除（`delete`）的设计意图**：假设 AI 生成了 1 个 `return null;`，但 git diff 中有 3 个 `return null;`（其中 2 个是用户手写的）。使用 `delete` 后只会计 1 个 AI 贡献，而非 3 个。这是**保守估计**——宁可低估，不高估。

## CLI 命令

```
opencode ai-report [--commit <hash>] [--staged] [--json] [--force] [--no-save]
```

| 选项 | 说明 |
|------|------|
| `--commit <hash>` | 分析指定 commit（默认 HEAD） |
| `--staged` | 分析暂存区变更（不绑定 commit hash） |
| `--json` | JSON 格式输出（CI/脚本消费） |
| `--force` | 重新计算已报告的 commit |
| `--no-save` | 仅输出报告，不持久化 |

### 终端输出

```
┌────────────────────────────────────────────────────────────────┐
│                      AI CONTRIBUTION                           │
├────────────────────────────────────────────────────────────────┤
│ Commit:  a1b2c3d                                               │
│ Branch:  feature/auth                                          │
│ Total +lines:  147                                             │
│ AI +lines:  58                                                 │
│ AI Rate:  39.5%                                                │
├────────────────────────────────────────────────────────────────┤
│ File                          +lines    AI       Rate          │
│ src/auth/login.ts                 45     38      84.4%         │
│ src/auth/middleware.ts            23     18      78.3%         │
│ src/auth/types.ts                 12      2      16.7%         │
│ test/auth.test.ts                 67      0       0.0%         │
├────────────────────────────────────────────────────────────────┤
│ Models:                                                        │
│   claude-sonnet-4-20250514                              87.0%  │
│   gpt-5.1                                               13.0%  │
│ Sessions:  2                                                   │
└────────────────────────────────────────────────────────────────┘
```

## post-commit Hook

### 安装

```
opencode hook install [--force]
```

写入 `.git/hooks/post-commit`：

```bash
#!/bin/sh
# Installed by opencode — AI contribution tracking
opencode ai-report --commit HEAD
```

### 流程

```
git commit
  ↓
.git/hooks/post-commit
  ↓
opencode ai-report --commit HEAD
  ↓
1. git rev-parse HEAD / git log -1 --format=%ct HEAD
2. git diff --unified=999999 <parent> HEAD（首 commit 用 empty tree）
3. parsePatch → per-file hunks
4. 对每个文件: SELECT pending ai_diff WHERE filepath=X AND timestamp<=commitTime
5. 运行行级交集匹配算法
6. UPDATE ai_diff SET lifecycle='committed', commit_hash=X
7. INSERT INTO ai_commit_report
8. 输出报告到终端
```

## 边界情况

| 场景 | 处理 |
|------|------|
| **首次 commit（无 parent）** | 使用 git empty tree hash (`4b825dc...`) |
| **commit --amend** | post-commit hook 不触发；手动 `--force` 重算 |
| **rebase** | commit hash 变化 → 旧 `ai_commit_report` 行成为孤儿 |
| **AI 生成后人工完全重写** | 匹配率 ≈ 0%，ai_diff 行仍标记为 committed（避免永久残留） |
| **多 session 贡献同 commit** | session_ids 数组记录所有 session |
| **apply_patch 多文件** | 2层修复: tool 返回 `filediffs` 数组 + processor 支持遍历 |

## 项目结构

| 文件 | 说明 |
|------|------|
| `migration/20250715000000_add_lifecycle_commit_to_ai_diff/migration.sql` | ai_diff 新增 lifecycle/commit_hash/committed_at |
| `migration/20250715000001_add_ai_commit_report/migration.sql` | 新建 ai_commit_report 表 |
| `packages/opencode/src/session/ai-diff.sql.ts` | Drizzle schema: ai_diff 扩展 |
| `packages/opencode/src/session/ai-commit-report.sql.ts` | Drizzle schema: ai_commit_report |
| `packages/opencode/src/session/ai-diff.ts` | AiDiffEntry Schema 扩展 + 查询映射更新 |
| `packages/opencode/src/session/ai-report.ts` | AiReport Effect 服务: 匹配算法 + 持久化 |
| `packages/opencode/src/session/processor.ts` | 支持 filediffs 数组（apply_patch 多文件） |
| `packages/opencode/src/tool/apply_patch.ts` | 补齐 filediffs metadata |
| `packages/opencode/src/cli/cmd/ai-report.ts` | `opencode ai-report` CLI 命令 |
| `packages/opencode/src/cli/cmd/hook.ts` | `opencode hook install` CLI 命令 |
| `packages/opencode/src/index.ts` | 注册 AiReportCommand + HookCommand |
| `packages/opencode/src/effect/app-runtime.ts` | 添加 AiReport.defaultLayer |

## 未来扩展

- **远程数据库同步**：`lifecycle = 'synced'` 状态，CI 汇总所有 commit 的 AI 贡献率
- **pre-push hook**：push 前汇总当前分支所有 commit 的 AI 贡献率
- **`--gc` 命令**：清理 rebase 后的孤儿 `ai_commit_report` 行
- **`post-rewrite` hook**：支持 amend / rebase 后自动重新计算
