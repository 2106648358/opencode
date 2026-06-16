// AI diff 存储服务 — 持久化 write/edit 工具每次调用产生的 diff 数据。
// 默认层使用 SQLite（通过 Database/Drizzle）。Interface 抽象允许后续替换为
// 远程后端（PostgreSQL、S3 或专用 API），无需修改任何消费方代码。
//
// 每条记录包含：
//   - 修改了什么文件（filepath、diff、additions/deletions）
//   - 谁发起的修改（sessionID、agent、tool）
//   - 修改发生时间（timestamp）
//
// 用于后续与 git diff 对比，识别 AI 贡献的代码。
import { Effect, Layer, Context, Schema } from "effect"
import { Database } from "@/storage"
import { Log } from "@/util"
import { PartID } from "./schema"
import type { SessionID } from "./schema"
import { AiDiffTable } from "./ai-diff.sql"
import { eq, and, asc, gte, lte } from "drizzle-orm"

const log = Log.create({ service: "ai-diff" })

// AI diff 条目 Schema — 与 SQL 表列一一对应，保证类型安全的数据传递。
export const AiDiffEntry = Schema.Struct({
  id: Schema.String,
  session_id: Schema.String,
  message_id: Schema.String,
  part_id: Schema.String,
  agent: Schema.String,
  tool: Schema.String,
  model_id: Schema.String,
  model_name: Schema.String,
  provider_id: Schema.String,
  filepath: Schema.String,
  diff: Schema.String,
  additions: Schema.Number,
  deletions: Schema.Number,
  status: Schema.optional(Schema.String),
  timestamp: Schema.Number,
  lifecycle: Schema.String,
  commit_hash: Schema.optional(Schema.String),
  committed_at: Schema.optional(Schema.Number),
})
export type AiDiffEntry = typeof AiDiffEntry.Type

// store() 的输入类型 — 不含 id 和 timestamp（由服务自动生成）。
export const StoreInput = Schema.Struct({
  session_id: Schema.String,
  message_id: Schema.String,
  part_id: Schema.String,
  agent: Schema.String,
  tool: Schema.String,
  model_id: Schema.String,
  model_name: Schema.String,
  provider_id: Schema.String,
  filepath: Schema.String,
  diff: Schema.String,
  additions: Schema.Number,
  deletions: Schema.Number,
  status: Schema.optional(Schema.String),
})
export type StoreInput = typeof StoreInput.Type

// 查询过滤器 — 所有字段均为可选，支持灵活组合查询。
export const QueryFilter = Schema.Struct({
  session_id: Schema.optional(Schema.String),
  filepath: Schema.optional(Schema.String),
  tool: Schema.optional(Schema.String),
  since: Schema.optional(Schema.Number),
  until: Schema.optional(Schema.Number),
})
export type QueryFilter = typeof QueryFilter.Type

// 服务接口 — 将存储后端与业务逻辑解耦。
// 未来的云端实现（PostgreSQL、S3+索引、专用 API）只需实现相同的方法即可替换。
export interface Interface {
  // 持久化一条 AI diff 记录。id 和 timestamp 由服务自动生成。
  readonly store: (input: StoreInput) => Effect.Effect<void>

  // 按可选条件查询记录，结果按时间戳升序排列。
  readonly query: (filter: QueryFilter) => Effect.Effect<AiDiffEntry[]>

  // 删除指定会话的所有 AI diff 记录（用于会话清理时调用）。
  readonly removeBySession: (sessionID: SessionID) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AiDiff") {}

// 默认实现：基于 Database 模块（Drizzle ORM）的 SQLite 存储。
// 架构选型理由：选用 SQLite 而非 JSON 文件，原因如下：
// 1. 二进制格式比纯文本 JSON 更难以被用户随意篡改
// 2. 完整 SQL 查询支持，可按 session/filepath/时间范围灵活过滤
// 3. Drizzle ORM 支持无缝迁移到 PostgreSQL（同 Schema，仅换连接串）
// 4. 代码库已集成（迁移系统、LocalContext 等）
// 显式标注类型：R = never（不依赖任何 Effect 服务，仅使用 Database.use() 同步调用）
export const layer: Layer.Layer<Service, never, never> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const store = Effect.fn("AiDiff.store")(function* (input: StoreInput) {
      log.info("storing AI diff", {
        session: input.session_id,
        tool: input.tool,
        model: input.model_id,
        filepath: input.filepath,
        additions: input.additions,
        deletions: input.deletions,
      })

      const id = PartID.ascending()
      const now = Date.now()

      Database.use((db) =>
        db
          .insert(AiDiffTable)
          .values({
            id,
            session_id: input.session_id,
            message_id: input.message_id,
            part_id: input.part_id,
            agent: input.agent,
            tool: input.tool,
            model_id: input.model_id,
            model_name: input.model_name,
            provider_id: input.provider_id,
            filepath: input.filepath,
            diff: input.diff,
            additions: input.additions,
            deletions: input.deletions,
            status: input.status ?? null,
            timestamp: now,
          })
          .run(),
      )
      log.info("AI diff stored", { id, filepath: input.filepath })
    })

    const query = Effect.fn("AiDiff.query")(function* (filter: QueryFilter) {
      log.info("querying AI diffs", {
        session: filter.session_id,
        filepath: filter.filepath,
        tool: filter.tool,
      })

      // 根据传入的过滤条件动态构建 WHERE 子句。
      const conditions: ReturnType<typeof eq>[] = []
      if (filter.session_id) conditions.push(eq(AiDiffTable.session_id, filter.session_id))
      if (filter.filepath) conditions.push(eq(AiDiffTable.filepath, filter.filepath))
      if (filter.tool) conditions.push(eq(AiDiffTable.tool, filter.tool))
      if (filter.since !== undefined) conditions.push(gte(AiDiffTable.timestamp, filter.since))
      if (filter.until !== undefined) conditions.push(lte(AiDiffTable.timestamp, filter.until))

      // 分两条路径以避免 Drizzle 条件 where 子句的类型推断问题。
      const rows = Database.use((db) =>
        conditions.length > 0
          ? db
              .select()
              .from(AiDiffTable)
              .where(and(...conditions))
              .orderBy(asc(AiDiffTable.timestamp))
              .all()
          : db
              .select()
              .from(AiDiffTable)
              .orderBy(asc(AiDiffTable.timestamp))
              .all(),
      )

      // 将数据库 snake_case 行映射为 camelCase 的 AiDiffEntry 对象。
      return rows.map((row) => ({
        id: row.id,
        session_id: row.session_id,
        message_id: row.message_id,
        part_id: row.part_id,
        agent: row.agent,
        tool: row.tool,
        model_id: row.model_id,
        model_name: row.model_name,
        provider_id: row.provider_id,
        filepath: row.filepath,
        diff: row.diff,
        additions: row.additions,
        deletions: row.deletions,
        status: row.status ?? undefined,
        timestamp: row.timestamp,
        lifecycle: row.lifecycle,
        commit_hash: row.commit_hash ?? undefined,
        committed_at: row.committed_at ?? undefined,
      }))
    })

    const removeBySession = Effect.fn("AiDiff.removeBySession")(function* (sessionID: SessionID) {
      log.info("removing AI diffs for session", { session: sessionID })
      Database.use((db) =>
        db.delete(AiDiffTable).where(eq(AiDiffTable.session_id, sessionID)).run(),
      )
      log.info("AI diffs removed for session", { session: sessionID })
    })

    return Service.of({ store, query, removeBySession })
  }),
)

// 自包含默认层 — 仅依赖 Database 模块，无其他服务依赖。
export const defaultLayer = layer

export * as AiDiff from "./ai-diff"
