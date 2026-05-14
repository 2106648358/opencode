# AI 代码溯源追踪技术设计

> 2026-05-14 | 状态：设计阶段

## 一、概述

### 目标

追踪 AI 每次对文件的修改，区分**不同模型**的贡献。在用户 `git commit` 后自动匹配 commit diff 中的行，标记哪些行由 AI 生成。提供**提交级**和**项目级** AI 代码占比统计，支持按模型维度拆解。

### 核心设计决策

| 决策 | 内容 |
|------|------|
| 存储粒度 | **hunk 级**（一次 AI 操作 = 一条 hunk 记录），与操作粒度一致 |
| 匹配粒度 | **行级**（HunkMatcher 内部拆分 hunk 为单行比对） |
| 指纹计算 | **匹配时计算**，不锁死在存储 schema 中 |
| 匹配策略 | 三级级联：规范化行 hash → 上下文 hash → 相似度匹配 |
| 模型区分 | **hunk 级记录模型**，commit 级按模型拆解统计 |

### 非目标

- 不保证 100% 精确（用户再编辑的内容无法追溯）
- 不处理二进制文件
- 不保证 100% 精确（用户再编辑的内容无法追溯）

---

## 二、数据模型

### 2.1 消费池表：`ai_code_hunk`

```sql
CREATE TABLE ai_code_hunk (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL,
  message_id    TEXT NOT NULL,
  part_id       TEXT NOT NULL,
  file_path     TEXT NOT NULL,        -- 相对 worktree 路径
  start_line    INTEGER NOT NULL,     -- AI 写入时的起始行号（仅参考，不参与 hash）
  end_line      INTEGER NOT NULL,     -- 结束行号
  content       TEXT NOT NULL,        -- 完整代码块（原始内容，保留缩进和换行符）
  model_id       TEXT NOT NULL,        -- 生成此代码的模型 ID（如 'deepseek-v4-pro'）
  tool          TEXT NOT NULL,        -- 'edit' | 'write' | 'apply_patch'
  time_created  INTEGER NOT NULL,

  -- 匹配状态
  status        TEXT DEFAULT 'consumed',  -- consumed → matched → verified
  match_type    TEXT,                     -- 'exact' | 'fuzzy'
  commit_hash   TEXT,                     -- 匹配到的 git commit SHA
  match_file    TEXT,                     -- commit 中实际文件路径
  match_line    INTEGER,                  -- commit 中实际匹配到的起始行号
  matched_at    INTEGER
);

CREATE INDEX idx_hunk_session ON ai_code_hunk(session_id);
CREATE INDEX idx_hunk_file    ON ai_code_hunk(file_path);
CREATE INDEX idx_hunk_status  ON ai_code_hunk(status);
CREATE INDEX idx_hunk_model   ON ai_code_hunk(model_id);
```

**字段说明**：

- `content` 存 AI 写入的原始文本，保留换行符和缩进。匹配前在内存中 normalize（统一缩进为 2 空格、统一换行符为 `\n`），然后拆行算指纹
- `start_line` / `end_line` 不参与 hash，仅用于匹配时按行号距离排序（行号相近的 hunk 优先尝试匹配）
- `model_id` 记录生成此代码的 AI 模型标识（取自 `ctx.assistantMessage.model.modelID`），用于按模型维度统计贡献
- `status` 三态流转：`consumed`（已入池，等待匹配）→ `matched`（已匹配到 commit）→ `verified`（用户已审查确认）
- `match_type` 区分匹配精度：`exact`（hash 精确命中）或 `fuzzy`（相似度匹配）

### 2.2 提交统计表：`ai_commit_stats`

```sql
CREATE TABLE ai_commit_stats (
  commit_hash   TEXT NOT NULL,
  project_id    TEXT NOT NULL,
  total_lines   INTEGER NOT NULL,       -- 本次提交新增总行数
  ai_lines      INTEGER NOT NULL,       -- AI 生成行数（exact + fuzzy）
  ai_exact      INTEGER NOT NULL,       -- 精确匹配行数
  ai_fuzzy      INTEGER NOT NULL,       -- 模糊匹配行数
  human_lines   INTEGER NOT NULL,       -- 未匹配到 AI 的行数
  files_changed INTEGER NOT NULL,       -- 涉及文件数
  files_ai      INTEGER NOT NULL,       -- 包含 AI 代码的文件数
  model_breakdown TEXT,                 -- JSON: { "deepseek-v4-pro": { lines:50, exact:48, fuzzy:2 }, ... }
  time_created  INTEGER NOT NULL,

  PRIMARY KEY (commit_hash, project_id)
);

CREATE INDEX idx_commit_stats_project ON ai_commit_stats(project_id);
```

**设计说明**：

- 主键 `(commit_hash, project_id)` —— 不同 project 可能有不同文件路径映射到同一个 commit（如 monorepo）
- 使用 `UPSERT` 语义：同一个 commit 重新匹配时可以覆盖更新
- `model_breakdown` 为 JSON 列，存储本次 commit 中各模型的贡献行数明细，由 `HunkMatcher` 聚合写入
- `time_created` 记录统计生成时间，不是 commit 时间

**查询示例**：

```sql
-- 某项目所有 commit 的 AI 占比趋势
SELECT
  commit_hash,
  total_lines,
  ai_lines,
  ROUND(ai_lines * 100.0 / total_lines, 1) AS ai_percent,
  model_breakdown
FROM ai_commit_stats
WHERE project_id = 'xxx'
ORDER BY time_created;

-- 项目总览（各模型贡献）
SELECT
  h.model_id,
  SUM(LENGTH(h.content) - LENGTH(REPLACE(h.content, CHAR(10), '')) + 1) AS lines
FROM ai_code_hunk h
JOIN session s ON s.id = h.session_id
WHERE s.project_id = 'xxx' AND h.status IN ('matched', 'verified')
GROUP BY h.model_id;
```

---

## 三、指纹策略（匹配时计算，不存入数据库）

### 3.1 主指纹：规范化行 hash

```
simple_hash = SHA256(
  file_path +
  '\0' +
  normalize(line_content)
)
```

**normalize 规则**：
1. trim 首尾空白
2. 统一缩进：所有行首空白替换为等量 2 空格缩进
3. 统一换行符为 `\n`
4. 不处理代码语义（如 `int x=1;` 和 `int x = 1;` 仍视为不同）

**覆盖场景**：用户插 import、改缩进、换行符差异均可命中。处理 80%+ 的常规场景。

### 3.2 辅助指纹：上下文 hash（仅对高频行计算）

**高频行定义**：同一个文件路径下，某行内容在 `ai_code_hunk` 中出现过 ≥ 2 次的行。典型例：`}`、`return;`、`}`。

```
context_hash = SHA256(
  file_path +
  '\0' +
  normalize(prev_line) +
  '\0' +
  normalize(current_line) +
  '\0' +
  normalize(next_line)
)
```

**关键设计**：`prev_line` 和 `next_line` 取自**匹配时的 commit diff hunk 上下文**，不取自 AI 写入时的上下文。原因：用户可能在 AI 代码前后插删行，但 commit hunk 内的相邻行不会变。

**优化**：hunk 的边界行（第一行和最后一行）的上下文 hash 可能在匹配时不可用（commit hunk 边界不同）。此时降级为 simple_hash。

### 3.3 为什么指纹不在存储时计算

- 存储 `content` 原文，匹配时 normalize → 指纹策略可以独立升级，不修改 schema 和历史数据
- 后续若加入 AST 级 hash，不需要迁移表结构
- `context_hash` 的邻居行在匹配时才能确定

---

## 四、匹配算法：`HunkMatcher`

### 4.1 输入

- 消费池：`ai_code_hunk WHERE file_path = ? AND status = 'consumed'`
- commit diff：通过 `git show <commit> --format="" -- <file>` 获取

### 4.2 算法

```
FUNCTION MatchCommit(commit_hash, project_id):

  FOR EACH file IN git show --name-only <commit>:

    1. 解析 commit diff → 提取 hunk 列表
       每个 hunk: { old_start, new_start, lines: [{ type: '+'|'-'|' ', content }] }

    2. 加载消费池：
       candidates = SELECT * FROM ai_code_hunk
                    WHERE file_path = <file> AND status = 'consumed'
                    ORDER BY ABS(start_line - commit_hunk.new_start)

    3. 预计算高频行集合（整个文件范围）：
       freq_lines = { content 出现 ≥ 2 次的规范化行 }

    4. FOR EACH commit_hunk:
         FOR EACH added_line (type = '+'):

           a. calc simple_hash = SHA256(file + '\0' + normalize(line.content))
           b. 在全部 candidates 的 content 拆分行中查 simple_hash
           c. 命中 → record match: { type: 'exact', hunk_id, match_line }

           d. 未命中 AND 该行是高频行:
              calc context_hash = SHA256(file + '\0' + normalize(prev) + '\0'
                                          + normalize(current) + '\0' + normalize(next))
              查 candidates 的 context_hash
              命中 → record match: { type: 'exact', hunk_id, match_line }

           e. 仍未命中:
              FOR EACH candidate.hunk.lines:
                similarity = Levenshtein(line, candidate_line)
                IF similarity > 0.9:
                  record match: { type: 'fuzzy', hunk_id, match_line, similarity }
                  BREAK

    5. 回写消费池：
       FOR EACH match_record:
         UPDATE ai_code_hunk SET
           status = 'matched',
           match_type = <type>,
           commit_hash = <hash>,
           match_line = <line>,
           matched_at = <now>

     6. 聚合统计（commit 级 + 模型级）：
        total_lines   = commit diff 中所有新增行
        ai_lines      = 匹配行数（exact + fuzzy）
        ai_exact      = exact 匹配行数
        ai_fuzzy      = fuzzy 匹配行数
        human_lines   = total_lines - ai_lines
        model_breakdown = 按 model_id 分组聚合：
          { "<model_id>": { "lines": N, "exact": N, "fuzzy": N }, ... }

        UPSERT INTO ai_commit_stats VALUES (..., model_breakdown)

    7. 生成/更新 ai-code-map.json
```

### 4.3 匹配行为规格

| 场景 | 行为 |
|------|------|
| AI 写 10 行，用户直接提交 | 全部 10 行 exact 匹配 |
| AI 写 10 行，用户删了 2 行 | 剩余 8 行 exact 匹配 |
| AI 写 10 行，用户改名变量 1 行 | 9 行 exact + 1 行 fuzzy |
| AI 写 10 行，用户格式化 | normalize 后全部 exact 匹配 |
| AI 写 `}`，同文件有另一个 `}` | context_hash 区分，exact 匹配 |
| AI 写但用户完全重写 | 无匹配，标记为 human |
| 同一 commit 匹配多个 AI session 的代码 | 各自匹配各自的 hunk 记录 |

---

## 五、溯源输出：`ai-code-map.json`

匹配完成后的溯源文件，按项目存放于项目根目录的 `.opencode/ai-code-map.json`：

```json
{
  "project": "ai-credit-main",
  "generated_at": "2026-05-14T10:00:00Z",
  "last_commit": "abc1234def567",
  "commits": {
    "abc1234def567": {
      "total_lines": 150,
      "ai_lines": 98,
      "ai_percent": 65.3,
      "ai_exact": 92,
      "ai_fuzzy": 6,
      "human_lines": 52,
      "files": 5,
      "files_with_ai": 3,
      "model_breakdown": {
        "deepseek-v4-pro": { "lines": 50, "exact": 48, "fuzzy": 2 },
        "claude-sonnet":    { "lines": 48, "exact": 44, "fuzzy": 4 }
      }
    }
  },
  "files": {
    "src/main/ABADemo.java": {
      "total_lines": 200,
      "ai_lines": [
        {
          "lines": "10-15",
          "model": "deepseek-v4-pro",
          "session": "ses_xxx",
          "status": "verified",
          "match_type": "exact",
          "committed_in": "abc1234",
          "verified_at": "2026-05-14T10:30:00Z"
        },
        {
          "lines": "40-42",
          "model": "claude-sonnet",
          "session": "ses_yyy",
          "status": "matched",
          "match_type": "fuzzy",
          "committed_in": "abc1234"
        }
      ]
    }
  }
}
```

**放置位置**：`.opencode/ai-code-map.json` —— 不随代码提交，避免干扰 git 仓库。

**更新策略**：每次 `ai-match` 后合并更新，新的 commit 追加到 `commits`，已 `verified` 的行保持不被覆盖。

---

## 六、工具层接入

### 6.1 `tool/edit.ts`

**现状**：已通过 `return { metadata: { diff, filediff, ... } }` 返回完整的 diff 信息。

**需做**：在 `processor.ts:completeToolCall()` 中，判断 `output.metadata.filediff` 存在后，解析 hunk 并写入 `ai_code_hunk`。

**解析逻辑**：
- 从 `output.metadata.filediff.patch` 中提取 `+` 开头的连续行
- 按 `@@ -a,b +c,d @@` 头获取 `start_line` 和 `end_line`（c 到 c+d-1）
- 拼接新增行为 `content`
- INSERT 到 `ai_code_hunk`

### 6.2 `tool/write.ts`

**现状**：`write.ts:91-97` 的 `return metadata` 中**不含** `diff` 或 `filediff` 字段。diff 只在权限提示 `ctx.ask()` 时生成然后丢弃。

**需做**：在 `return metadata` 中补上 `filediff`：

```ts
return {
  title: path.relative(Instance.worktree, filepath),
  metadata: {
    diagnostics,
    filepath,
    exists,
    filediff: {
      file: filepath,
      patch: diff,                          // 已在 line 52 生成
      additions: contentNew.split('\n').length,
      deletions: contentOld.split('\n').length,
      status: exists ? 'modified' : 'added'
    }
  },
  output,
}
```

write 工具的整个文件内容作为一个 hunk（`start_line=1`, `end_line=N`）。

### 6.3 `tool/apply_patch.ts`

**现状**：return metadata 包含 `files: Array<{ file, patch, additions, deletions }>`。

**需做**：在 `completeToolCall` 中，遍历 `output.metadata.files`，每个元素写入一条 `ai_code_hunk`。

### 6.4 `processor.ts`

在 `completeToolCall` 函数（`processor.ts:171-195`）中，`yield* session.updatePart(...)` 之后，`yield* settleToolCall(toolCallID)` 之前，加入：

```ts
if (output.metadata?.filediff) {
  yield* insertAiCodeHunk(output.metadata.filediff, ...)
}
if (output.metadata?.files) {
  for (const f of output.metadata.files) {
    yield* insertAiCodeHunk(f, ...)
  }
}
```

---

## 七、CLI 命令

### 7.1 `opencode ai-match <commit-hash>`

匹配单个 commit，生成统计和溯源文件。

```bash
opencode ai-match abc1234              # 当前项目
opencode ai-match abc1234 --project xxx # 指定项目
```

### 7.2 `opencode ai-match --since <date>`

批量匹配某个日期之后的所有 commit。

```bash
opencode ai-match --since 2026-05-01
```

### 7.3 `opencode ai-stats`

查看项目 AI 代码占比统计。

```bash
opencode ai-stats                      # 当前项目总览
opencode ai-stats --detail             # 逐 commit 明细
opencode ai-stats --file src/foo.java  # 单文件详情
```

---

## 十、存储抽象与可演进性

### 10.1 HunkStore 接口

当前使用 SQLite 直连存储，通过接口抽象隔离底层实现，方便后续替换为远端存储。

```ts
// src/ai-code/hunk-store.ts

interface HunkRecord {
  id: string
  session_id: string
  message_id: string
  part_id: string
  file_path: string
  start_line: number
  end_line: number
  content: string
  model_id: string
  tool: string
  time_created: number
  status: string
  match_type?: string
  commit_hash?: string
  match_file?: string
  match_line?: number
  matched_at?: number
}

interface MatchResult {
  hunk_id: string
  match_type: 'exact' | 'fuzzy'
  match_line: number
  similarity?: number
}

interface CommitStats {
  commit_hash: string
  project_id: string
  total_lines: number
  ai_lines: number
  ai_exact: number
  ai_fuzzy: number
  human_lines: number
  files_changed: number
  files_ai: number
  model_breakdown: Record<string, { lines: number; exact: number; fuzzy: number }>
}

interface HunkStore {
  insert(hunk: HunkRecord): Effect<void>
  queryByFile(filePath: string): Effect<HunkRecord[]>
  updateMatch(id: string, match: MatchResult): Effect<void>
  upsertCommitStats(stats: CommitStats): Effect<void>
  getProjectStats(projectId: string): Effect<CommitStats[]>
}
```

### 10.2 实现与替换路径

```
Phase 1 (当前)
  LocalHunkStore  →  SQLite (ai_code_hunk 表)
  HunkMatcher 只通过 HunkStore 接口访问 → 不感知底层

Phase 4 (未来迭代)
  RemoteHunkStore → HTTP API (JWT 鉴权) → 云端数据库
  替换方式：修改 Layer 中的 HunkStore 实现类
           ↓
  HunkMatcher / tool.ts / processor.ts 无感知，零改动
```

### 10.3 本地到远端的迁移方式

设计上无需数据迁移动——本地和远端各表独立运行。切换时只需配置指向新实现。

---

## 十一、文件清单

| 文件 | 改动 | 说明 |
|------|------|------|
| `session/session.sql.ts` | 修改 | 新增 `AiCodeHunkTable`、`AiCommitStatsTable` schema |
| `migration/<timestamp>_ai_code_authorship/migration.sql` | 新增 | DDL |
| `src/ai-code/schema.sql.ts` | 新增 | Hunk 表和统计表 schema 定义 |
| `src/ai-code/hunk-store.ts` | 新增 | HunkStore 接口 + LocalHunkStore 实现 |
| `src/ai-code/index.ts` | 新增 | 模块入口，insertHunk / matchCommit / getProjectStats |
| `src/ai-code/hunk-matcher.ts` | 新增 | HunkMatcher 匹配算法 |
| `src/ai-code/fingerprint.ts` | 新增 | simple_hash / context_hash 计算 |
| `src/ai-code/commit-parser.ts` | 新增 | 解析 commit diff 为结构化 hunk |
| `session/processor.ts` | 修改 | `completeToolCall` 中插入 hunk 记录 |
| `tool/write.ts` | 修改 | return metadata 补 `filediff` |
| `cli/cmd/ai-match.ts` | 新增 | `ai-match` CLI 命令 |
| `cli/cmd/ai-stats.ts` | 新增 | `ai-stats` CLI 命令 |

---

## 十二、未决事项

| 事项 | 选项 | 建议 |
|------|------|------|
| `ai-code-map.json` 存放位置 | `.opencode/` 或项目根 | `.opencode/` 不干扰代码仓库 |
| 匹配触发方式 | CLI 命令 / git hook / TUI 面板 | 先 CLI，后续 TUI |
| fuzzy 匹配阈值 | 百分比 | 90% Levenshtein 相似度 |
| `verified` 状态更新 | CLI / TUI | 先 CLI `opencode ai-verify --file` |
| write 工具的 filediff | 改 write.ts 还是由 processor 统一生成 | 改 write.ts 补 filediff |

---

## 十三、演进路径

1. **Phase 1**：`LocalHunkStore`（SQLite）+ 核心匹配 + CLI 命令
2. **Phase 2**：TUI 面板集成（可视化 ai-code-map.json）
3. **Phase 3**：git hook 自动触发匹配（post-commit）
4. **Phase 4**：`RemoteHunkStore`（HTTP API + 云数据库）+ API 鉴权防伪造
5. **Phase 5**：多租户支持，跨项目聚合统计仪表板
