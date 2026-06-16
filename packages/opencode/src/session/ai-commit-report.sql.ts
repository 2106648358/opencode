// AI commit 报告表 — 持久化每个 commit 的 AI 贡献率统计。
// 由 post-commit hook 触发 opencode ai-report 写入。
// 后续同步到远程数据库后，CI 可直接查询汇总。
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core"

export const AiCommitReportTable = sqliteTable(
  "ai_commit_report",
  {
    commit_hash: text().primaryKey(),
    branch: text().notNull(),
    // commit 总新增行数
    total_additions: integer().notNull(),
    // AI 贡献的新增行数
    ai_additions: integer().notNull(),
    // AI 贡献率 (0.0 – 1.0)
    ai_rate: real().notNull(),
    // JSON: [{filepath, total, ai, rate}]
    file_breakdown: text().notNull(),
    // JSON: ["ses_xxx", "ses_yyy"]
    session_ids: text().notNull(),
    // JSON: [{model_id, additions, rate}]
    model_breakdown: text().notNull(),
    // 报告生成时间戳（ms）
    created_at: integer().notNull(),
  },
  (table) => [
    index("ai_commit_report_branch_idx").on(table.branch),
    index("ai_commit_report_created_at_idx").on(table.created_at),
  ],
)
