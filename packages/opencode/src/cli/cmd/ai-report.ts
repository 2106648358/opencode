import type { Argv } from "yargs"
import { Effect } from "effect"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { AppRuntime } from "@/effect/app-runtime"
import { AiReport } from "@/session/ai-report"
import type { CommitReport } from "@/session/ai-report"
import { Git } from "@/git"
import { EOL } from "os"

export const AiReportCommand = cmd({
  command: "ai-report",
  describe: "compute AI contribution rate for a commit",
  builder: (yargs: Argv) => {
    return yargs
      .option("commit", {
        describe: "analyze a specific commit (default: HEAD)",
        type: "string",
      })
      .option("staged", {
        describe: "analyze staged changes instead of a commit",
        type: "boolean",
      })
      .option("json", {
        describe: "output in JSON format",
        type: "boolean",
      })
      .option("force", {
        describe: "recompute even if report already exists",
        type: "boolean",
      })
      .option("no-save", {
        describe: "do not persist the report to database",
        type: "boolean",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      if (args.staged) {
        const report = await AppRuntime.runPromise(
          Effect.gen(function* () {
            const svc = yield* AiReport.Service
            return yield* svc.computeStagedRate({ noSave: args["no-save"] })
          }),
        )
        if (args.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + EOL)
        } else {
          displayReport(report)
        }
        return
      }

      // 默认分析 HEAD
      let commitHash = args.commit

      if (!commitHash) {
        // 通过 git 获取 HEAD 的 hash
        const result = await AppRuntime.runPromise(
          Effect.gen(function* () {
            const git = yield* Git.Service
            return yield* git.run(["rev-parse", "HEAD"], { cwd: process.cwd() })
          }),
        )
        if (result.exitCode !== 0) {
          process.stderr.write("No commits found in this repository." + EOL)
          return
        }
        commitHash = result.text().trim()
      }

      const report = await AppRuntime.runPromise(
        Effect.gen(function* () {
          const svc = yield* AiReport.Service
          return yield* svc.computeCommitRate(commitHash!, {
            force: args.force,
            noSave: args["no-save"],
          })
        }),
      )

      if (args.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + EOL)
      } else {
        displayReport(report)
      }
    })
  },
})

function displayReport(report: CommitReport) {
  const width = 64

  const padEnd = (text: string, len: number) => {
    // 中文字符占 2 个宽度
    let visible = 0
    for (const ch of text) {
      visible += ch.charCodeAt(0) > 127 ? 2 : 1
    }
    return text + " ".repeat(Math.max(0, len - visible))
  }

  const renderRow = (label: string, value: string): string => {
    const availableWidth = width - 1
    const labelWidth = label.split("").reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)
    const paddingNeeded = availableWidth - labelWidth - value.length
    const padding = Math.max(0, paddingNeeded)
    return `│${label}${" ".repeat(padding)}${value} │`
  }

  // 文件列表渲染
  const maxFileLen = Math.min(36, Math.max(...report.files.map((f) => f.filepath.length), 10))
  const filesToShow = report.files
    .toSorted((a, b) => b.total - a.total)
    .slice(0, 30)

  // Header
  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + " ".repeat(Math.floor((width - "AI CONTRIBUTION".length) / 2)) + "AI CONTRIBUTION" + " ".repeat(Math.ceil((width - "AI CONTRIBUTION".length) / 2)) + "│")
  console.log("├" + "─".repeat(width) + "┤")
  console.log(renderRow("Commit", report.commit.slice(0, 16)))
  if (report.branch) {
    console.log(renderRow("Branch", report.branch))
  }
  console.log(renderRow("Total +lines", report.total_additions.toLocaleString()))
  console.log(renderRow("AI +lines", report.ai_additions.toLocaleString()))
  console.log(renderRow("AI Rate", (report.ai_rate * 100).toFixed(1) + "%"))
  console.log("├" + "─".repeat(width) + "┤")

  // File breakdown
  if (filesToShow.length > 0) {
    const headerLine =
      `│ ${padEnd("File", maxFileLen)}  ${padEnd("+lines", 7)}  ${padEnd("AI", 7)}  Rate │`
    console.log(headerLine)
    console.log("├" + "─".repeat(width) + "┤")

    for (const file of filesToShow) {
      const displayFile =
        file.filepath.length > maxFileLen
          ? "..." + file.filepath.slice(file.filepath.length - maxFileLen + 3)
          : file.filepath
      const rate = (file.rate * 100).toFixed(1) + "%"
      console.log(
        `│ ${padEnd(displayFile, maxFileLen)}  ${padEnd(file.total.toLocaleString(), 7)}  ${padEnd(file.ai.toLocaleString(), 7)}  ${padEnd(rate, 6)} │`,
      )
    }
    console.log("├" + "─".repeat(width) + "┤")
  }

  // Model breakdown
  if (report.models.length > 0) {
    console.log("│ Models:" + " ".repeat(width - 8) + "│")
    for (const model of report.models) {
      const label = `  ${model.model_name}`
      const rateStr = (model.rate * 100).toFixed(1) + "%"
      console.log(renderRow(label, rateStr))
    }
  }

  // Session info
  if (report.sessions.length > 0) {
    console.log(renderRow("Sessions", report.sessions.length.toString()))
  }

  console.log("└" + "─".repeat(width) + "┘")
}
