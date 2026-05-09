import path from "path"
import { parse as parseYaml } from "yaml"
import { loadSchema, parseSchema, type SchemaDefinition } from "./schema"

export type ChangeInfo = {
  name: string
  path: string
  schema: string
  taskProgress?: { total: number; complete: number }
}

const OPENSPEC_DIR = "openspec"
const CHANGES_DIR = "changes"
const ARCHIVE_DIR = "archive"

export function changesDir(projectDir: string) {
  return path.join(projectDir, OPENSPEC_DIR, CHANGES_DIR)
}

export function archiveDir(projectDir: string) {
  return path.join(projectDir, OPENSPEC_DIR, CHANGES_DIR, ARCHIVE_DIR)
}

export function changeDir(projectDir: string, name: string) {
  return path.join(projectDir, OPENSPEC_DIR, CHANGES_DIR, name)
}

/** Read the .openspec.yaml file inside a change directory to get schema name */
export async function getChangeSchema(changePath: string): Promise<string> {
  const metaPath = path.join(changePath, ".openspec.yaml")
  const metaFile = Bun.file(metaPath)
  if (await metaFile.exists()) {
    const raw = await metaFile.text()
    const parsed = parseYaml(raw) as Record<string, unknown> | null
    if (parsed && typeof parsed.schema === "string") return parsed.schema
  }
  return "spec-driven"
}

export async function getDefaultSchema(projectDir: string): Promise<string> {
  const configPath = path.join(projectDir, OPENSPEC_DIR, "config.yaml")
  const configFile = Bun.file(configPath)
  if (await configFile.exists()) {
    const raw = await configFile.text()
    const parsed = parseYaml(raw) as Record<string, unknown> | null
    if (parsed && typeof parsed.schema === "string") return parsed.schema
  }
  const configYmlPath = path.join(projectDir, OPENSPEC_DIR, "config.yml")
  const configYmlFile = Bun.file(configYmlPath)
  if (await configYmlFile.exists()) {
    const raw = await configYmlFile.text()
    const parsed = parseYaml(raw) as Record<string, unknown> | null
    if (parsed && typeof parsed.schema === "string") return parsed.schema
  }
  return "spec-driven"
}

export async function createChange(
  projectDir: string,
  name: string,
  schemaName: string,
  description?: string,
): Promise<{ name: string; path: string; schema: string }> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`Invalid change name "${name}". Must be kebab-case (e.g., "add-user-auth").`)
  }

  const dir = changeDir(projectDir, name)
  if (await Bun.file(path.join(dir, ".openspec.yaml")).exists()) {
    throw new Error(`Change "${name}" already exists at ${dir}`)
  }

  // Ensure parent directories exist
  await Bun.write(
    path.join(dir, ".gitkeep"),
    "",
  )

  // Load the schema
  const schema = await loadSchema(schemaName, projectDir, {
    exists: async (p) => await Bun.file(p).exists(),
    readFile: async (p) => await Bun.file(p).text(),
  })

  // Create .openspec.yaml metadata
  const meta = {
    schema: schemaName,
    created: new Date().toISOString(),
    ...(description ? { description } : {}),
  }
  await Bun.write(
    path.join(dir, ".openspec.yaml"),
    Object.entries(meta)
      .map(([k, v]) => `${k}: ${typeof v === "string" && v.includes(" ") ? `"${v}"` : v}`)
      .join("\n") + "\n",
  )

  // Create empty artifact files based on schema's generates patterns
  for (const artifact of schema.artifacts) {
    // For glob patterns like "specs/**/*.md", skip - they get created manually
    if (artifact.generates.includes("*")) continue

    const artifactPath = path.join(dir, artifact.generates)
    const parentDir = path.dirname(artifactPath)
    const parentExists = await Bun.file(path.join(parentDir, ".gitkeep")).exists() ||
      await Bun.file(path.join(parentDir, ".openspec.yaml")).exists()

    // Ensure parent directory exists
    await Bun.write(
      path.join(parentDir, ".gitkeep"),
      "",
    )
    // Write empty artifact file
    await Bun.write(artifactPath, "")
  }

  // Clean up .gitkeep files in the change directory
  const gitkeepPath = path.join(dir, ".gitkeep")
  if (await Bun.file(gitkeepPath).exists()) {
    try { await Bun.file(gitkeepPath).delete() } catch {}
  }

  // Also clean up in subdirectories
  for (const entry of schema.artifacts) {
    if (entry.generates.includes("*")) continue
    const artifactDir = path.dirname(path.join(dir, entry.generates))
    const artifactGitkeep = path.join(artifactDir, ".gitkeep")
    if (artifactDir !== dir && await Bun.file(artifactGitkeep).exists()) {
      try { await Bun.file(artifactGitkeep).delete() } catch {}
    }
  }

  return { name, path: dir, schema: schemaName }
}

export async function listChanges(projectDir: string): Promise<ChangeInfo[]> {
  const dir = changesDir(projectDir)
  if (!(await Bun.file(path.join(dir, ".gitkeep")).exists()) &&
      !(await Bun.file(path.join(dir, "archive")).exists())) {
    // Try listing via the directory itself
  }

  const changes: ChangeInfo[] = []
  const glob = new Bun.Glob("*/.openspec.yaml")

  try {
    for await (const match of glob.scan({ cwd: dir, absolute: false })) {
      const changeName = match.split(path.sep)[0]!
      const changePath = path.join(dir, changeName)
      const schema = await getChangeSchema(changePath)

      const tasksPath = path.join(changePath, "tasks.md")
      let taskProgress: { total: number; complete: number } | undefined
      if (await Bun.file(tasksPath).exists()) {
        const raw = await Bun.file(tasksPath).text()
        const total = (raw.match(/- \[[ x]\]/g) || []).length
        const complete = (raw.match(/- \[x\]/g) || []).length
        if (total > 0) taskProgress = { total, complete }
      }

      changes.push({ name: changeName, path: changePath, schema, taskProgress })
    }
  } catch {
    // changes directory may not exist
  }

  return changes
}

export async function archiveChange(
  projectDir: string,
  name: string,
): Promise<string> {
  const src = changeDir(projectDir, name)
  const metaPath = path.join(src, ".openspec.yaml")
  if (!(await Bun.file(metaPath).exists())) {
    throw new Error(`Change "${name}" not found at ${src}`)
  }

  const date = new Date().toISOString().split("T")[0]!
  const archiveName = `${date}-${name}`
  const dest = path.join(archiveDir(projectDir), archiveName)

  if (await Bun.file(path.join(dest, ".openspec.yaml")).exists()) {
    throw new Error(`Archive "${archiveName}" already exists`)
  }

  // Ensure archive directory exists
  await Bun.write(path.join(dest, ".gitkeep"), "")

  // Move all files
  const glob = new Bun.Glob("**/*")
  for await (const file of glob.scan({ cwd: src, absolute: false })) {
    const srcFile = path.join(src, file)
    const destFile = path.join(dest, file)
    const destDir = path.dirname(destFile)
    await Bun.write(destFile, Bun.file(srcFile))
    // Clean up gitkeep
    const destGitkeep = path.join(destDir, ".gitkeep")
    if (await Bun.file(destGitkeep).exists() && destFile !== destGitkeep) {
      try { await Bun.file(destGitkeep).delete() } catch {}
    }
  }

  // Remove source directory recursively
  const rm = async (dirToRemove: string) => {
    for await (const entry of (Bun as any).readdir?.(dirToRemove) ?? []) {
      if (typeof entry === "string") {
        const p = path.join(dirToRemove, entry)
        try {
          const stat = await Bun.file(p).stat()
          if (stat.isDirectory()) await rm(p)
          else try { await Bun.file(p).delete() } catch {}
        } catch {
          try { await Bun.file(p).delete() } catch {}
        }
      }
    }
    try { await Bun.file(path.join(dirToRemove, ".gitkeep")).delete() } catch {}
  }

  await rm(src)

  return archiveName
}

export function validateChangeName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) return { valid: false, error: "Name is required" }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name))
    return { valid: false, error: `Invalid name "${name}". Must be kebab-case (e.g., "add-user-auth").` }
  return { valid: true }
}
