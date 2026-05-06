import path from "path"
import matter from "gray-matter"
import { Log, Filesystem } from "../util"
import type { RepoEntry } from "./repo"

const log = Log.create({ service: "template.file" })

export type TemplateMeta = {
  name: string
  description?: string
}

export type TemplateEntry = {
  name: string
  description?: string
  content: string
  filePath: string
  repo: "local" | string
}

export async function listTemplates(dir: string): Promise<TemplateEntry[]> {
  const { Glob } = await import("@opencode-ai/core/util/glob")
  const files = await Glob.scan("*.md", { cwd: dir, absolute: true, include: "file" })
  const result: TemplateEntry[] = []
  for (const filePath of files) {
    try {
      const entry = await readTemplate(filePath)
      result.push(entry)
    } catch (err) {
      log.warn("skipping invalid template file", { filePath, error: String(err) })
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name))
  log.info("listed templates", { dir, count: result.length })
  return result
}

export async function readTemplate(filePath: string): Promise<TemplateEntry> {
  const text = await Filesystem.readText(filePath)
  const parsed = matter(text)
  const data = parsed.data as Partial<TemplateMeta>
  const name = data.name ?? path.basename(filePath, ".md")
  const repo = detectRepo(filePath)
  log.debug("read template", { name, repo, filePath })
  return {
    name,
    description: data.description,
    content: parsed.content.trim(),
    filePath,
    repo,
  }
}

export async function updateTemplate(filePath: string, content: string, description?: string): Promise<void> {
  const existing = await readTemplate(filePath)
  const frontmatter: Record<string, string | undefined> = {
    name: existing.name,
    description: description ?? existing.description,
  }
  const frontmatterStr = Object.entries(frontmatter)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
  const md = `---\n${frontmatterStr}\n---\n\n${content}`
  await Filesystem.write(filePath, md)
  log.info("updated template", { filePath })
}

export async function createTemplate(
  dir: string,
  name: string,
  content: string,
  description?: string,
): Promise<string> {
  const safeName = name.replace(/[<>:"/\\|?*]/g, "_")
  const filePath = path.join(dir, `${safeName}.md`)
  const frontmatter: Record<string, string | undefined> = {
    name: safeName,
    description,
  }
  const frontmatterStr = Object.entries(frontmatter)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
  const md = `---\n${frontmatterStr}\n---\n\n${content}`
  await Filesystem.write(filePath, md)
  log.info("created template", { name: safeName, filePath, dir })
  return filePath
}

export async function deleteTemplate(filePath: string): Promise<void> {
  const { unlink } = await import("fs/promises")
  await unlink(filePath)
  log.info("deleted template", { filePath })
}

function detectRepo(filePath: string): "local" | string {
  const templatesIndex = filePath.indexOf(path.join("templates", path.sep))
  if (templatesIndex === -1) return "local"
  const rest = filePath.slice(templatesIndex + "templates/".length)
  const parts = rest.split(path.sep)
  if (parts[0] === "local") return "local"
  return parts[0]
}

export function parseTemplateName(filePath: string): string {
  return path.basename(filePath, ".md")
}
