// AI 贡献率报告服务 — 将 git commit diff 与 ai_diff 记录做行级交集匹配，
// 计算每个 commit 的 AI 贡献率，并将结果持久化到 ai_commit_report 表。
//
// 状态机：ai_diff.lifecycle: pending → committed → synced
//   - pending: AI 生成，尚未匹配到 git commit
//   - committed: post-commit hook 匹配成功，写入 commit_hash
//   - synced: 数据已推送到远程数据库
//
// 匹配算法：行级交集 + 去重上限
//   从 git diff 中提取所有 +行，从 ai_diff 中提取所有 +行建立 Set，
//   逐行匹配，每匹配一次就从 Set 中删除，避免高频重复行（如 "}"、"return null"）膨胀 AI 率。
//   这是保守估计 — 宁可低估，不高估。
import { Effect, Layer, Context, Schema } from "effect"
import { parsePatch } from "diff"
import { AiDiff } from "./ai-diff"
import { AiCommitReportTable } from "./ai-commit-report.sql"
import { AiDiffTable } from "./ai-diff.sql"
import { Database } from "@/storage"
import { Git } from "@/git"
import { Log } from "@/util"
import { eq, and, lte } from "drizzle-orm"

const log = Log.create({ service: "ai-report" })

// 空树 hash — 用于首次 commit（无 parent）的 diff
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf899d9e5a4d7a14e"

// 单文件贡献率结果
export const FileContribution = Schema.Struct({
  filepath: Schema.String,
  total: Schema.Number,
  ai: Schema.Number,
  rate: Schema.Number,
})
export type FileContribution = typeof FileContribution.Type

// 模型维度贡献率
export const ModelContribution = Schema.Struct({
  model_id: Schema.String,
  model_name: Schema.String,
  additions: Schema.Number,
  rate: Schema.Number,
})
export type ModelContribution = typeof ModelContribution.Type

// 完整的 commit 报告
export const CommitReport = Schema.Struct({
  commit: Schema.String,
  branch: Schema.optional(Schema.String),
  total_additions: Schema.Number,
  ai_additions: Schema.Number,
  ai_rate: Schema.Number,
  files: Schema.Array(FileContribution),
  sessions: Schema.Array(Schema.String),
  models: Schema.Array(ModelContribution),
})
export type CommitReport = typeof CommitReport.Type

// 从 unified diff 中提取所有新增行（去掉行首的 + 符号，跳过文件头）
const extractAddedLines = (patchText: string): string[] => {
  if (!patchText) return []
  try {
    const parsed = parsePatch(patchText)
    const lines: string[] = []
    for (const file of parsed) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.startsWith("+") && !line.startsWith("+++")) {
            lines.push(line.substring(1))
          }
        }
      }
    }
    return lines
  } catch {
    return []
  }
}

// 行级交集匹配 — 保守估计，每行只匹配一次
const computeFileOverlap = (gitDiff: string, aiDiffs: string[]): { ai: number; total: number } => {
  const gitLines = extractAddedLines(gitDiff)
  if (gitLines.length === 0) return { ai: 0, total: 0 }

  // 将所有 AI diff 中的 +行合并到 Set（去重）
  const aiLineSet = new Set<string>()
  for (const diff of aiDiffs) {
    for (const line of extractAddedLines(diff)) {
      aiLineSet.add(line)
    }
  }

  // 逐行匹配，每匹配一次就从 Set 中删除
  let aiCount = 0
  for (const line of gitLines) {
    if (aiLineSet.has(line)) {
      aiCount++
      aiLineSet.delete(line)
    }
  }

  return { ai: aiCount, total: gitLines.length }
}

export interface Interface {
  // 计算指定 commit 的 AI 贡献率
  readonly computeCommitRate: (
    commitHash: string,
    opts?: { force?: boolean; noSave?: boolean },
  ) => Effect.Effect<CommitReport>

  // 计算暂存区变更的 AI 贡献率（不绑定 commit hash）
  readonly computeStagedRate: (opts?: { noSave?: boolean }) => Effect.Effect<CommitReport>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AiReport") {}

export const layer: Layer.Layer<Service, never, Git.Service | AiDiff.Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const git = yield* Git.Service
    const aiDiff = yield* AiDiff.Service

    // 运行 git 命令并返回文本输出
    const gitText = Effect.fn("AiReport.gitText")(function* (args: string[], cwd: string) {
      const result = yield* git.run(args, { cwd })
      if (result.exitCode !== 0) return ""
      return result.text()
    })

    // 获取 commit 的 unified diff 文本
    const getCommitDiff = Effect.fn("AiReport.getCommitDiff")(function* (cwd: string, commitHash: string) {
      // 尝试获取 parent commit，如果是首次 commit 则使用空树
      const parentResult = yield* git.run(
        ["log", "--format=%P", "-n", "1", commitHash],
        { cwd },
      )
      const parents = parentResult.exitCode === 0 ? parentResult.text().split(/\s+/).filter(Boolean) : []
      const parent = parents.length > 0 ? parents[0] : EMPTY_TREE

      return yield* gitText(["diff", "--unified=999999", parent, commitHash], cwd)
    })

    // 获取暂存区的 unified diff
    const getStagedDiff = Effect.fn("AiReport.getStagedDiff")(function* (cwd: string) {
      return yield* gitText(["diff", "--cached", "--unified=999999"], cwd)
    })

    // 获取分支名
    const getBranch = Effect.fn("AiReport.getBranch")(function* (cwd: string) {
      return yield* git.branch(cwd)
    })

    // 获取 commit 时间戳（秒）
    const getCommitTime = Effect.fn("AiReport.getCommitTime")(function* (cwd: string, commitHash: string) {
      const text = yield* gitText(["log", "--format=%ct", "-n", "1", commitHash], cwd)
      const ts = Number.parseInt(text.trim(), 10)
      return Number.isFinite(ts) ? ts : 0
    })

    // 检查报告是否已存在
    const reportExists = Effect.fn("AiReport.reportExists")(function* (commitHash: string) {
      return Database.use((db) =>
        db
          .select({ commit_hash: AiCommitReportTable.commit_hash })
          .from(AiCommitReportTable)
          .where(eq(AiCommitReportTable.commit_hash, commitHash))
          .get(),
      )
    })

    const computeCommitRate = Effect.fn("AiReport.computeCommitRate")(
      function* (commitHash: string, opts?: { force?: boolean; noSave?: boolean }) {
        const cwd = process.cwd()

        // 去重检查
        if (!opts?.force) {
          const existing = yield* reportExists(commitHash)
          if (existing) {
            log.info("report already exists, skipping", { commit: commitHash })
            return {
              commit: commitHash,
              total_additions: 0,
              ai_additions: 0,
              ai_rate: 0,
              files: [],
              sessions: [],
              models: [],
            } satisfies CommitReport
          }
        }

        // 获取 git 信息
        const [diffText, branch, commitTime] = yield* Effect.all(
          [getCommitDiff(cwd, commitHash), getBranch(cwd), getCommitTime(cwd, commitHash)],
          { concurrency: 3 },
        )

        if (!diffText) {
          log.info("empty diff for commit", { commit: commitHash })
          return {
            commit: commitHash,
            branch,
            total_additions: 0,
            ai_additions: 0,
            ai_rate: 0,
            files: [],
            sessions: [],
            models: [],
          } satisfies CommitReport
        }

        // 解析 diff 获取文件级别的 patch
        let parsedDiffs: ReturnType<typeof parsePatch>
        try {
          parsedDiffs = parsePatch(diffText)
        } catch {
          log.info("failed to parse diff", { commit: commitHash })
          return {
            commit: commitHash,
            branch,
            total_additions: 0,
            ai_additions: 0,
            ai_rate: 0,
            files: [],
            sessions: [],
            models: [],
          } satisfies CommitReport
        }

        // 全局模型统计
        const modelAdditions = new Map<string, { model_name: string; additions: number }>()
        const sessionSet = new Set<string>()

        const fileContributions: FileContribution[] = []
        let totalAdditions = 0
        let totalAiAdditions = 0

        for (const parsed of parsedDiffs) {
          // 跳过二进制文件 / 空文件
          if (!parsed.newFileName || parsed.newFileName === "/dev/null") continue
          const filepath = parsed.newFileName.replace(/^[ab]\//, "")

          // 提取该文件在 git diff 中的 patch 文本（用于行提取）
          const filePatch = parsed.hunks
            .map((hunk) => hunk.lines.join("\n"))
            .join("\n")

          // 统计 git 新增行数
          let gitAdditions = 0
          for (const hunk of parsed.hunks) {
            for (const line of hunk.lines) {
              if (line.startsWith("+") && !line.startsWith("+++")) {
                gitAdditions++
              }
            }
          }
          if (gitAdditions === 0) continue

          // 查询该文件在 commit 时间前的 pending AI diff 记录
          const commitTimeMs = commitTime * 1000
          const aiRecords = yield* aiDiff.query({
            filepath,
            since: Math.max(0, commitTimeMs - 7 * 24 * 60 * 60 * 1000), // 往前 7 天窗口
            until: commitTimeMs,
          })

          // 过滤 lifecycle=pending 的记录（query 接口目前不支持 lifecycle 过滤，在应用层过滤）
          const pendingRecords = aiRecords.filter((r) => r.lifecycle !== "committed" && r.lifecycle !== "synced")

          if (pendingRecords.length === 0) {
            fileContributions.push({ filepath, total: gitAdditions, ai: 0, rate: 0 })
            totalAdditions += gitAdditions
            continue
          }

          // 运行匹配算法
          const { ai, total } = computeFileOverlap(
            filePatch,
            pendingRecords.map((r) => r.diff),
          )

          // 收集 session 和 model 信息
          for (const record of pendingRecords) {
            sessionSet.add(record.session_id)
            const key = record.model_id
            const existing = modelAdditions.get(key)
            if (existing) {
              existing.additions += ai
            } else {
              modelAdditions.set(key, { model_name: record.model_name, additions: ai })
            }
          }

          const rate = total > 0 ? ai / total : 0
          fileContributions.push({ filepath, total: gitAdditions, ai, rate })
          totalAdditions += gitAdditions
          totalAiAdditions += ai
        }

        const overallRate = totalAdditions > 0 ? totalAiAdditions / totalAdditions : 0

        // 构建模型贡献列表
        const totalModelAdditions = [...modelAdditions.values()].reduce((sum, m) => sum + m.additions, 0)
        const models: ModelContribution[] = [...modelAdditions.entries()].map(([model_id, info]) => ({
          model_id,
          model_name: info.model_name,
          additions: info.additions,
          rate: totalModelAdditions > 0 ? info.additions / totalModelAdditions : 0,
        }))

        const report: CommitReport = {
          commit: commitHash,
          branch: branch ?? undefined,
          total_additions: totalAdditions,
          ai_additions: totalAiAdditions,
          ai_rate: overallRate,
          files: fileContributions,
          sessions: [...sessionSet],
          models,
        }

        // 持久化
        if (!opts?.noSave) {
          // 更新 ai_diff 中的匹配记录
          Database.use((db) => {
            for (const parsed of parsedDiffs) {
              if (!parsed.newFileName || parsed.newFileName === "/dev/null") continue
              const filepath = parsed.newFileName.replace(/^[ab]\//, "")
              // 将该文件中所有 pending 记录标记为 committed
              db
                .update(AiDiffTable)
                .set({
                  lifecycle: "committed",
                  commit_hash: commitHash,
                  committed_at: Date.now(),
                })
                .where(
                  and(
                    eq(AiDiffTable.filepath, filepath),
                    eq(AiDiffTable.lifecycle, "pending"),
                  ),
                )
                .run()
            }
          })

          // 写入 ai_commit_report
          Database.use((db) =>
            db
              .insert(AiCommitReportTable)
              .values({
                commit_hash: commitHash,
                branch: branch ?? "",
                total_additions: totalAdditions,
                ai_additions: totalAiAdditions,
                ai_rate: overallRate,
                file_breakdown: JSON.stringify(fileContributions),
                session_ids: JSON.stringify([...sessionSet]),
                model_breakdown: JSON.stringify(models),
                created_at: Date.now(),
              })
              .run(),
          )

          log.info("report saved", {
            commit: commitHash,
            branch: branch ?? "",
            ai_rate: overallRate,
            files: fileContributions.length,
          })
        }

        return report
      },
    )

    const computeStagedRate = Effect.fn("AiReport.computeStagedRate")(
      function* (opts?: { noSave?: boolean }) {
        const cwd = process.cwd()
        const diffText = yield* getStagedDiff(cwd)

        if (!diffText) {
          return {
            commit: "(staged)",
            total_additions: 0,
            ai_additions: 0,
            ai_rate: 0,
            files: [],
            sessions: [],
            models: [],
          } satisfies CommitReport
        }

        let parsedDiffs: ReturnType<typeof parsePatch>
        try {
          parsedDiffs = parsePatch(diffText)
        } catch {
          return {
            commit: "(staged)",
            total_additions: 0,
            ai_additions: 0,
            ai_rate: 0,
            files: [],
            sessions: [],
            models: [],
          } satisfies CommitReport
        }

        const modelAdditions = new Map<string, { model_name: string; additions: number }>()
        const sessionSet = new Set<string>()
        const fileContributions: FileContribution[] = []
        let totalAdditions = 0
        let totalAiAdditions = 0

        for (const parsed of parsedDiffs) {
          if (!parsed.newFileName || parsed.newFileName === "/dev/null") continue
          const filepath = parsed.newFileName.replace(/^[ab]\//, "")

          const filePatch = parsed.hunks.map((hunk) => hunk.lines.join("\n")).join("\n")

          let gitAdditions = 0
          for (const hunk of parsed.hunks) {
            for (const line of hunk.lines) {
              if (line.startsWith("+") && !line.startsWith("+++")) {
                gitAdditions++
              }
            }
          }
          if (gitAdditions === 0) continue

          const now = Date.now()
          const aiRecords = yield* aiDiff.query({
            filepath,
            since: Math.max(0, now - 7 * 24 * 60 * 60 * 1000),
            until: now,
          })

          const pendingRecords = aiRecords.filter((r) => r.lifecycle !== "committed" && r.lifecycle !== "synced")

          if (pendingRecords.length === 0) {
            fileContributions.push({ filepath, total: gitAdditions, ai: 0, rate: 0 })
            totalAdditions += gitAdditions
            continue
          }

          const { ai, total } = computeFileOverlap(
            filePatch,
            pendingRecords.map((r) => r.diff),
          )

          for (const record of pendingRecords) {
            sessionSet.add(record.session_id)
            const key = record.model_id
            const existing = modelAdditions.get(key)
            if (existing) {
              existing.additions += ai
            } else {
              modelAdditions.set(key, { model_name: record.model_name, additions: ai })
            }
          }

          const rate = total > 0 ? ai / total : 0
          fileContributions.push({ filepath, total: gitAdditions, ai, rate })
          totalAdditions += gitAdditions
          totalAiAdditions += ai
        }

        const overallRate = totalAdditions > 0 ? totalAiAdditions / totalAdditions : 0
        const totalModelAdditions = [...modelAdditions.values()].reduce((sum, m) => sum + m.additions, 0)
        const models: ModelContribution[] = [...modelAdditions.entries()].map(([model_id, info]) => ({
          model_id,
          model_name: info.model_name,
          additions: info.additions,
          rate: totalModelAdditions > 0 ? info.additions / totalModelAdditions : 0,
        }))

        return {
          commit: "(staged)",
          total_additions: totalAdditions,
          ai_additions: totalAiAdditions,
          ai_rate: overallRate,
          files: fileContributions,
          sessions: [...sessionSet],
          models,
        } satisfies CommitReport
      },
    )

    return Service.of({ computeCommitRate, computeStagedRate })
  }),
)

// 自包含默认层
export const defaultLayer = layer.pipe(
  Layer.provide(AiDiff.defaultLayer),
  Layer.provide(Git.defaultLayer),
)

export * as AiReport from "./ai-report"
