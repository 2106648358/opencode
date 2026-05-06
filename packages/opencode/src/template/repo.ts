import path from "path"
import { Global } from "@opencode-ai/core/global"
import { Log, Filesystem } from "../util"

const log = Log.create({ service: "template.repo" })

export type RepoEntry = {
  name: string
  url: string
  description?: string
  added_at: number
}

type ReposData = {
  repos: RepoEntry[]
}

const REPOS_FILE = path.join(Global.Path.data, "templates", "repos.json")

function templateDir(name: string) {
  return path.join(Global.Path.data, "templates", name)
}

export function repoDir(repo: RepoEntry) {
  return templateDir(repo.name)
}

export async function loadRepos(): Promise<RepoEntry[]> {
  try {
    const data = await Filesystem.readJson<ReposData>(REPOS_FILE)
    log.info("loaded repos", { count: data.repos.length, path: REPOS_FILE })
    return data.repos ?? []
  } catch {
    log.debug("no repos file yet", { path: REPOS_FILE })
    return []
  }
}

export async function saveRepos(repos: RepoEntry[]): Promise<void> {
  await Filesystem.writeJson(REPOS_FILE, { repos } as ReposData)
  log.info("saved repos", { count: repos.length, path: REPOS_FILE })
}

export async function addRepo(name: string, url: string, description?: string): Promise<RepoEntry> {
  const repos = await loadRepos()
  const existing = repos.find((r) => r.name === name)
  if (existing) {
    log.warn("repo already exists, updating", { name, url })
    existing.url = url
    if (description !== undefined) existing.description = description
  } else {
    repos.push({ name, url, description, added_at: Date.now() })
  }
  await saveRepos(repos)
  log.info("added repo", { name, url })
  return repos.find((r) => r.name === name)!
}

export async function removeRepo(name: string): Promise<void> {
  const repos = await loadRepos()
  const filtered = repos.filter((r) => r.name !== name)
  if (filtered.length === repos.length) {
    log.warn("repo not found for removal", { name })
    return
  }
  await saveRepos(filtered)
  log.info("removed repo", { name })
}

export async function removeRepoDir(repo: RepoEntry): Promise<void> {
  const dir = repoDir(repo)
  try {
    const { rm } = await import("fs/promises")
    await rm(dir, { recursive: true, force: true })
    log.info("removed repo directory", { name: repo.name, dir })
  } catch (err) {
    log.warn("failed to remove repo directory", { name: repo.name, dir, error: String(err) })
  }
}

export async function ensureTemplateDir(): Promise<void> {
  const dir = templateDir("local")
  const exists = await Filesystem.exists(dir)
  if (!exists) {
    const { mkdir } = await import("fs/promises")
    await mkdir(dir, { recursive: true })
    log.info("created template directory", { dir })
  }
}

export { templateDir, REPOS_FILE }
