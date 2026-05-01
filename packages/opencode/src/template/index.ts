import { ConfigTemplate } from "@/config/template"
import * as ConfigMarkdown from "@/config/markdown"
import path from "path"
import os from "os"
import fs from "fs/promises"

const log = (...args: unknown[]) => console.debug("[template]", ...args)

export interface SyncedRepo {
  url: string
  ref?: string
  name: string
  dir: string
}

export interface ParsedTemplate {
  key: string
  name: string
  description: string
  variables: { name: string; description?: string }[]
  body: string
  filePath: string
  repoName: string
}

export type SyncResult =
  | { ok: true; repo: string }
  | { ok: false; repo: string; error: string }

export function getRootDir(): string {
  return path.join(os.homedir(), ".opencode", "templates")
}

export function repoDir(name: string): string {
  return path.join(getRootDir(), name)
}

function shortname(url: string): string {
  const name = path.basename(url, ".git")
  return name || "default"
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function scanDir(dir: string): Promise<string[]> {
  const result: string[] = []
  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") await walk(full)
      } else if (entry.name.endsWith(".md")) {
        result.push(full)
      }
    }
  }
  await walk(dir)
  return result
}

export async function init(config: ConfigTemplate.Info): Promise<SyncedRepo[]> {
  if (!config.repos?.length) return []

  const repos: SyncedRepo[] = []
  for (const ref of config.repos) {
    const name = shortname(ref.url)
    const dir = repoDir(name)
    const exists = await dirExists(dir)
    if (!exists) {
      await fs.mkdir(path.dirname(dir), { recursive: true })
      const args = ["clone", "--depth", "1"]
      if (ref.ref) args.push("--branch", ref.ref)
      args.push(ref.url, dir)
      const clone = Bun.spawnSync(["git", ...args], { cwd: path.dirname(dir) })
      if (clone.exitCode !== 0) continue
    }
    repos.push({ url: ref.url, ref: ref.ref, name, dir })
  }
  return repos
}

export async function sync(repos: SyncedRepo[]): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  for (const repo of repos) {
    const pull = Bun.spawnSync(["git", "-C", repo.dir, "pull", "--ff-only"])
    results.push(
      pull.exitCode === 0
        ? { ok: true, repo: repo.name }
        : { ok: false, repo: repo.name, error: pull.stderr.toString().trim() },
    )
  }
  return results
}

export async function loadFile(filePath: string): Promise<ParsedTemplate | undefined> {
  const md = await ConfigMarkdown.parse(filePath).catch(() => undefined)
  if (!md) return

  const key = path.basename(filePath, ".md")
  const data = md.data as Record<string, unknown>
  const rawName = data.name
  return {
    key,
    name: typeof rawName === "string" ? rawName : key,
    description: typeof data.description === "string" ? data.description : "",
    variables: Array.isArray(data.variables)
      ? (data.variables as { name: string; description?: string }[]).filter(
          (v): v is { name: string; description?: string } => typeof v.name === "string",
        )
      : [],
    body: md.content,
    filePath,
    repoName: path.basename(path.dirname(filePath)),
  }
}

export async function load(repos: SyncedRepo[]): Promise<ParsedTemplate[]> {
  const all: ParsedTemplate[] = []
  for (const repo of repos) {
    const files = await scanDir(repo.dir)
    for (const file of files) {
      const t = await loadFile(file)
      if (t) all.push(t)
    }
  }
  return all
}

export class TemplateRegistry {
  private templates = new Map<string, ParsedTemplate>()
  private callbacks = new Set<(templates: ParsedTemplate[]) => void>()
  repos: SyncedRepo[] = []

  async init(config: ConfigTemplate.Info): Promise<void> {
    this.repos = await init(config)
    await this.refresh()
  }

  async refresh(): Promise<void> {
    const all = await load(this.repos)
    this.templates.clear()
    for (const t of all) this.templates.set(t.key, t)
    this.notify()
  }

  get(key: string): ParsedTemplate | undefined {
    return this.templates.get(key)
  }

  list(): ParsedTemplate[] {
    return [...this.templates.values()]
  }

  onUpdate(cb: (templates: ParsedTemplate[]) => void): () => void {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  private notify() {
    const all = this.list()
    for (const cb of this.callbacks) cb(all)
  }
}

export interface WatcherOptions {
  repos: SyncedRepo[]
  registry: TemplateRegistry
  intervalMs?: number
}

let watcherCleanup: (() => void) | null = null

export async function startWatcher(opts: WatcherOptions): Promise<void> {
  stopWatcher()
  const interval = opts.intervalMs ?? 60_000

  const id = setInterval(async () => {
    try {
      const results = await sync(opts.repos)
      const changed = results.some((r) => r.ok)
      if (changed) await opts.registry.refresh()
    } catch (err) {
      log("sync error:", err)
    }
  }, interval)

  watcherCleanup = () => {
    clearInterval(id)
    watcherCleanup = null
  }
}

export function stopWatcher(): void {
  watcherCleanup?.()
}

export * as Template from "./index"
export * as TemplateVariables from "./variables"
