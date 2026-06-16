// AI diff 表 — 持久化 write/edit/apply_patch 工具每次调用产生的 diff 详情。
// 每行记录一次 AI 工具调用修改的一个文件，后续可与 git diff 对比，识别 master 上 AI 贡献的代码。
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"

export const AiDiffTable = sqliteTable(
  "ai_diff",
  {
    id: text().primaryKey(),
    session_id: text().notNull(),
    message_id: text().notNull(),
    part_id: text().notNull(),
    agent: text().notNull(),
    tool: text().notNull(),
    model_id: text().notNull(),
    model_name: text().notNull(),
    provider_id: text().notNull(),
    filepath: text().notNull(),
    // 统一 diff 字符串（git 兼容格式），便于直接与 git diff 做对比
    diff: text().notNull(),
    additions: integer().notNull(),
    deletions: integer().notNull(),
    status: text(),
    // 工具调用完成时的毫秒时间戳
    timestamp: integer().notNull(),
    // 生命周期状态: pending → committed → synced
    lifecycle: text().notNull().default("pending"),
    // 关联的 git commit SHA（post-commit hook 匹配后写入）
    commit_hash: text(),
    // commit 发生时间戳（ms），在匹配时与 timestamp 区分
    committed_at: integer(),
    ...Timestamps,
  },
  (table) => [
    index("ai_diff_session_idx").on(table.session_id),
    index("ai_diff_filepath_idx").on(table.filepath),
    index("ai_diff_tool_idx").on(table.tool),
    index("ai_diff_timestamp_idx").on(table.timestamp),
    index("ai_diff_lifecycle_idx").on(table.lifecycle),
    index("ai_diff_commit_hash_idx").on(table.commit_hash),
  ],
)
