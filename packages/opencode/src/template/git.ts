import { Log, Filesystem } from "../util"
import { run } from "../util/process"
import type { RepoEntry } from "./repo"

const log = Log.create({ service: "template.git" })

const GIT_CFG = [
  "--no-optional-locks",
  "-c", "core.autocrlf=false",
  "-c", "core.longpaths=true",
]

export type GitResult = {
  code: number
  stdout: string
  stderr: string
}

async function git(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): Promise<GitResult> {
  try {
    const result = await run(["git", ...GIT_CFG, ...args], {
      cwd: opts.cwd,
      env: opts.env,
      nothrow: true,
      timeout: 120_000,
    })
    return {
      code: result.code,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    }
  } catch (err) {
    return {
      code: 1,
      stdout: "",
      stderr: String(err),
    }
  }
}

export function needsAuth(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase()
  return (
    msg.includes("authentication required") ||
    msg.includes("authentication failed") ||
    msg.includes("permission denied") ||
    msg.includes("could not read from remote") ||
    msg.includes("403") ||
    msg.includes("401")
  )
}

export async function cloneRepo(url: string, dir: string, token?: string): Promise<void> {
  const cloneUrl = token ? embedToken(url, token) : url
  log.info("cloning repo", { url: sanitizeUrl(url), dir })

  const { mkdir, rm, readdir } = await import("fs/promises")

  const exists = await readdir(dir).catch(() => undefined)
  if (exists && exists.length > 0) {
    log.warn("directory already exists, removing before clone", { dir })
    await rm(dir, { recursive: true, force: true })
  }

  await mkdir(dir, { recursive: true })

  const result = await git(["clone", cloneUrl, dir])
  if (result.code !== 0) {
    log.error("clone failed", { url: sanitizeUrl(url), stderr: result.stderr })
    throw new GitError(`clone 失败: ${result.stderr}`, result.stderr)
  }
  log.info("clone completed", { url: sanitizeUrl(url), dir })
}

export async function pullRepo(dir: string): Promise<void> {
  log.info("pulling repo", { dir })
  const result = await git(["pull", "--ff-only"], { cwd: dir })
  if (result.code !== 0) {
    log.warn("pull failed", { dir, stderr: result.stderr })
    if (result.stderr.includes("local changes")) {
      throw new GitError("有未提交的本地变更，请先提交或暂存", result.stderr)
    }
    throw new GitError(`同步失败: ${result.stderr}`, result.stderr)
  }
  log.info("pull completed", { dir })
}

export async function repoHasRemote(dir: string): Promise<boolean> {
  const result = await git(["remote", "-v"], { cwd: dir })
  return result.code === 0 && result.stdout.trim().length > 0
}

export async function submitMr(
  repo: RepoEntry,
  message: string,
  token?: string,
): Promise<void> {
  const dir = repoDir(repo)
  const branch = `template-update-${Date.now()}`
  const pushUrl = token ? embedToken(repo.url, token) : undefined
  log.info("submitting MR", { repo: repo.name, branch })

  const checkout = await git(["checkout", "-b", branch], { cwd: dir })
  if (checkout.code !== 0) {
    log.error("branch creation failed", { stderr: checkout.stderr })
    throw new GitError(`创建分支失败: ${checkout.stderr}`, checkout.stderr)
  }

  const add = await git(["add", "-A"], { cwd: dir })
  if (add.code !== 0) {
    log.error("git add failed", { stderr: add.stderr })
    throw new GitError(`暂存文件失败: ${add.stderr}`, add.stderr)
  }

  const commit = await git(["commit", "-m", message], {
    cwd: dir,
    env: pushUrl ? { GIT_ASKPASS: "echo", GIT_USERNAME: "token" } : undefined,
  })
  if (commit.code !== 0) {
    if (commit.stderr.includes("nothing to commit")) {
      log.warn("nothing to commit", { dir })
      throw new GitError("没有需要提交的变更", commit.stderr)
    }
    log.error("commit failed", { stderr: commit.stderr })
    throw new GitError(`提交失败: ${commit.stderr}`, commit.stderr)
  }

  const env: Record<string, string> = {}
  if (pushUrl) {
    const result = await git(["remote", "set-url", "origin", pushUrl], { cwd: dir })
    if (result.code !== 0) {
      log.error("set-url failed", { stderr: result.stderr })
    }
    env.GIT_ASKPASS = "echo"
    env.GIT_USERNAME = "token"
  }

  const push = await git(["push", "origin", branch], { cwd: dir, env })
  if (push.code !== 0) {
    log.error("push failed", { stderr: push.stderr })
    throw new GitError(`推送失败: ${push.stderr}`, push.stderr)
  }

  log.info("push completed", { repo: repo.name, branch })

  if (pushUrl) {
    await git(["remote", "set-url", "origin", repo.url], { cwd: dir })
  }
}

export function extractRepoUrl(url: string): string {
  return sanitizeUrl(url)
}

function embedToken(url: string, token: string): string {
  try {
    const u = new URL(url)
    u.username = token
    u.password = ""
    return u.toString()
  } catch {
    if (url.startsWith("https://")) {
      return url.replace("https://", `https://${token}@`)
    }
    return url
  }
}

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.username) {
      u.username = "***"
      u.password = ""
      return u.toString()
    }
  } catch {}
  return url
}

function repoDir(repo: RepoEntry): string {
  const path = require("path") as typeof import("path")
  const { Global } = require("@opencode-ai/core/global") as typeof import("@opencode-ai/core/global")
  return path.join(Global.Path.data, "templates", repo.name)
}

export class GitError extends Error {
  readonly stderr: string
  constructor(message: string, stderr: string) {
    super(message)
    this.name = "TemplateGitError"
    this.stderr = stderr
  }
}
