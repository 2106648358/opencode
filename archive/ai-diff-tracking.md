# AI Diff 追踪功能

## 需求背景

将 `write`、`edit`、`apply_patch` 工具完成后的 diff 详情单独存储，便于后续与 git diff 对比，从而能够知道 master 分支中 AI 贡献了哪些代码。

## 架构设计

### 存储后端选型

| 维度 | JSON 文件 | **SQLite（采用）** | 远程 PostgreSQL | S3/OSS |
|------|-----------|---------------------|-----------------|--------|
| 防篡改 | 差 | 中 | 好 | 好 |
| 查询能力 | 无 | 强 | 强 | 弱 |
| 离线支持 | 好 | 好 | 否 | 否 |
| 云端迁移 | 困难 | 简单（Drizzle 同 Schema） | 天然 | 不同范式 |

**选型理由：**
1. SQLite 二进制格式比 JSON 更难以被用户随意修改
2. 完整 SQL 查询支持（按 session/filepath/时间范围过滤）
3. Drizzle ORM 支持无缝迁移到 PostgreSQL（同 Schema，仅换连接串）
4. 代码库已集成 Drizzle + 迁移系统

### 扩展性设计

通过 Effect `Interface` + `Tag` + `Layer` 模式抽象存储后端：

```ts
export interface Interface {
  readonly store: (input: StoreInput) => Effect.Effect<void>     // 存储一条 diff 记录
  readonly query: (filter: QueryFilter) => Effect.Effect<...[]>  // 按条件查询
  readonly removeBySession: (sessionID: SessionID) => ...        // 按会话清理
}
```

默认层使用 SQLite（Drizzle ORM），未来可替换为 PostgreSQL、S3+元数据索引或专用 API 服务。

## 数据模型

### ai_diff 表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text (PK) | 记录 ID |
| session_id | text | 会话 ID |
| message_id | text | 消息 ID |
| part_id | text | 工具调用部件 ID |
| agent | text | 代理名称 |
| tool | text | 工具名称（edit/write/apply_patch） |
| filepath | text | 文件路径 |
| diff | text | 统一 diff 字符串（git 兼容格式） |
| additions | integer | 新增行数 |
| deletions | integer | 删除行数 |
| status | text | 文件状态（added/deleted/modified） |
| timestamp | integer | 工具调用完成时的毫秒时间戳 |
| time_created | integer | 记录创建时间 |
| time_updated | integer | 记录更新时间 |

### 索引

- `ai_diff_session_idx` — 按会话查询
- `ai_diff_filepath_idx` — 按文件路径查询
- `ai_diff_tool_idx` — 按工具名称查询
- `ai_diff_timestamp_idx` — 按时间范围查询

## 数据写入流程

  1. 工具（edit/write/apply_patch）执行完成
1. 工具在 `ctx.metadata()` 中存储 `{ diff, filediff }`
2. `SessionProcessor.completeToolCall` 检测到工具为文件修改类工具
3. 从 `output.metadata.filediff` 提取 diff 数据
4. 调用 `AiDiff.store()` 写入 `ai_diff` 表

## 日志追踪

所有关键步骤均有日志输出，可通过 `dev.log` 搜索 `service=ai-diff` 查看：

```
INFO ...service=ai-diff... "storing AI diff" session=... tool=... filepath=... additions=... deletions=...
INFO ...service=ai-diff... "AI diff stored" id=... filepath=...
INFO ...service=session.processor... "storing AI diff from tool call" tool=... file=... session=...
```

## SQLite 查询示例

### 进入数据库

```bash
sqlite3 ~/.local/share/opencode/opencode.db
```

### 按 session 查询该次会话的所有 AI diff 记录

```sql
SELECT session_id, tool, filepath, additions, deletions, timestamp
FROM ai_diff
WHERE session_id = 'ses_1589fa025ffeQh7Iaaxv9u2fqx'
ORDER BY timestamp;
```

### 查看某条记录完整的 unified diff 内容

```sql
SELECT diff
FROM ai_diff
WHERE session_id = 'ses_1589fa025ffeQh7Iaaxv9u2fqx'
  AND filepath LIKE '%src\tool\edit.ts'
LIMIT 1;
```

### 统计某个 session 中 AI 新增/删除行数

```sql
SELECT
  tool,
  COUNT(*) AS file_count,
  SUM(additions) AS total_additions,
  SUM(deletions) AS total_deletions
FROM ai_diff
WHERE session_id = 'ses_1589fa025ffeQh7Iaaxv9u2fqx'
GROUP BY tool;
```

### 按文件路径查询所有历史修改记录

```sql
SELECT session_id, tool, additions, deletions, timestamp
FROM ai_diff
WHERE filepath LIKE '%src\tool\edit.ts'
ORDER BY timestamp DESC;
```

### 查询指定时间范围内的 AI diff

```sql
SELECT filepath, tool, additions, deletions, diff
FROM ai_diff
WHERE timestamp >= 1717800000000
  AND timestamp <= 1717900000000
ORDER BY timestamp;
```

### 导出数据用于后续与 git diff 对比

```bash
sqlite3 ~/.local/share/opencode/opencode.db "SELECT json_object(''filepath'', filepath, ''diff'', diff, ''additions'', additions, ''deletions'', deletions, ''timestamp'', timestamp) FROM ai_diff WHERE session_id='ses_1589fa025ffeQh7Iaaxv9u2fqx'" > ai-diff-export.jsonl
```

## 涉及文件

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/session/ai-diff.sql.ts` | Drizzle 表定义 |
| `packages/opencode/src/session/ai-diff.ts` | Effect 服务（Interface + Service + Layer） |
| `packages/opencode/migration/20260608205237_add_ai_diff_table/migration.sql` | DDL 迁移脚本 |
| `packages/opencode/src/tool/write.ts` | 补齐 filediff 元数据输出 |
| `packages/opencode/src/session/processor.ts` | 在 completeToolCall 中挂接 AiDiff.store() |
| `packages/opencode/src/storage/schema.ts` | 注册 AiDiffTable |
| `packages/opencode/src/effect/app-runtime.ts` | 合并 AiDiff.defaultLayer |
