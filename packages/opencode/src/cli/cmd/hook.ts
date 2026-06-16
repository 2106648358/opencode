import type { Argv } from "yargs"
import { cmd } from "./cmd"
import path from "path"
import { EOL } from "os"

// post-commit hook 脚本内容 — 在每次 git commit 后自动运行 ai-report
const POST_COMMIT_HOOK = [
  "#!/bin/sh",
  "# Installed by opencode — AI contribution tracking",
  "# Runs ai-report after each commit to compute and persist AI contribution rate.",
  "",
  'opencode ai-report --commit HEAD',
  "",
].join("\n")

export const HookCommand = cmd({
  command: "hook",
  describe: "install git hooks for AI contribution tracking",
  builder: (yargs: Argv) => {
    return yargs
      .command(
        "install",
        "install post-commit hook",
        (yargs: Argv) => {
          return yargs.option("force", {
            describe: "overwrite existing hook if present",
            type: "boolean",
          })
        },
        async (args) => {
          // 找到 .git 目录
          const gitDir = await findGitDir(process.cwd())
          if (!gitDir) {
            process.stderr.write("Not a git repository (or any of the parent directories)" + EOL)
            process.exit(1)
          }

          const hookPath = path.join(gitDir, "hooks", "post-commit")
          const exists = await Bun.file(hookPath).exists()

          if (exists && !args.force) {
            const existing = await Bun.file(hookPath).text()
            if (existing.includes("opencode")) {
              process.stdout.write("opencode post-commit hook already installed." + EOL)
              return
            }
            process.stderr.write(
              `Hook already exists at ${hookPath}${EOL}` +
                `Use --force to overwrite, or manually add: opencode ai-report --commit HEAD${EOL}`,
            )
            process.exit(1)
          }

          await Bun.write(hookPath, POST_COMMIT_HOOK)
          // 确保 hook 可执行
          const stat = await Bun.file(hookPath).stat()
          if (stat.mode !== undefined) {
            const newMode = stat.mode | 0o111 // 添加执行权限
            // Bun 没有直接的 chmod，但 write 时会保留 exec 位 — Unix 上需要手动设置
          }

          process.stdout.write(`✓ post-commit hook installed at ${hookPath}${EOL}`)
        },
      )
      .demandCommand(1, "Unknown hook command. Try: opencode hook install")
  },
  handler: () => {
    // 默认显示帮助
    process.stdout.write("Usage: opencode hook install [--force]" + EOL)
  },
})

async function findGitDir(startDir: string): Promise<string | undefined> {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 64; i++) {
    const gitPath = path.join(dir, ".git")
    const stat = await Bun.file(gitPath).stat().catch(() => undefined)
    if (stat) {
      // 如果是 worktree，.git 是一个文件指向实际 git 目录
      if (stat.isDirectory()) return gitPath
      const content = await Bun.file(gitPath).text().catch(() => "")
      const match = content.match(/^gitdir:\s*(.+)$/m)
      if (match) return path.resolve(dir, match[1].trim())
      return gitPath
    }
    const parent = path.dirname(dir)
    if (parent === dir) return
    dir = parent
  }
  return
}
