import path from "path"
import type { SchemaDefinition, Artifact } from "./schema"
import { loadSchema, loadTemplate } from "./schema"
import { changeDir } from "./change"

export type ArtifactStatus = "done" | "ready" | "blocked"

export type ArtifactState = {
  id: string
  status: ArtifactStatus
  missingDeps: string[]
}

export type ChangeContext = {
  changeName: string
  schemaName: string
  changeDir: string
  artifacts: ArtifactState[]
  isComplete: boolean
  applyRequires: string[]
}

const fsExists = async (p: string) => {
  try {
    return await Bun.file(p).exists()
  } catch {
    return false
  }
}

/**
 * Check if an artifact is "done" by looking at its generates pattern.
 * For single-file artifacts (e.g., proposal.md), check if the file exists AND is non-empty.
 * For glob patterns (e.g., specs/**\/*.md), check if any matching files exist.
 */
async function isArtifactDone(changePath: string, artifact: Artifact): Promise<boolean> {
  if (artifact.generates.includes("*")) {
    // Glob pattern - check if any subdirectory exists under the pattern base
    const base = artifact.generates.split("*")[0]!
    const globDir = path.join(changePath, base)
    if (!(await fsExists(globDir))) return false
    const glob = new Bun.Glob(path.relative(changePath, artifact.generates))
    let hasMatch = false
    for await (const _ of glob.scan({ cwd: changePath, absolute: false })) {
      hasMatch = true
      break
    }
    return hasMatch
  }

  const filePath = path.join(changePath, artifact.generates)
  if (!(await fsExists(filePath))) return false
  const content = await Bun.file(filePath).text()
  return content.trim().length > 0
}

export async function getChangeContext(
  projectDir: string,
  changeName: string,
  schemaName: string,
): Promise<ChangeContext> {
  const dir = changeDir(projectDir, changeName)
  const schema = await loadSchema(schemaName, projectDir, {
    exists: async (p) => await fsExists(p),
    readFile: async (p) => await Bun.file(p).text(),
  })

  // Compute topological sort of artifacts
  const artifactMap = new Map(schema.artifacts.map((a) => [a.id, a]))
  const artifactIds = schema.artifacts.map((a) => a.id)
  const doneStatus = new Map<string, boolean>()

  for (const artifact of schema.artifacts) {
    doneStatus.set(artifact.id, await isArtifactDone(dir, artifact))
  }

  const states: ArtifactState[] = schema.artifacts.map((artifact) => {
    const done = doneStatus.get(artifact.id)!
    if (done) return { id: artifact.id, status: "done", missingDeps: [] }

    const missingDeps = artifact.requires.filter((depId) => !doneStatus.get(depId))
    if (missingDeps.length > 0) return { id: artifact.id, status: "blocked", missingDeps }

    return { id: artifact.id, status: "ready", missingDeps: [] }
  })

  const isComplete = schema.apply.requires.every((req) => doneStatus.get(req))

  return {
    changeName,
    schemaName,
    changeDir: dir,
    artifacts: states,
    isComplete,
    applyRequires: schema.apply.requires,
  }
}

export async function getInstructions(
  projectDir: string,
  changeName: string,
  artifactIdOrApply: string,
): Promise<Record<string, unknown>> {
  const dir = changeDir(projectDir, changeName)

  // Read schema from .openspec.yaml
  const metaPath = path.join(dir, ".openspec.yaml")
  let schemaName = "spec-driven"
  if (await fsExists(metaPath)) {
    const raw = await Bun.file(metaPath).text()
    try {
      const parsed = (await import("yaml")).parse(raw) as Record<string, unknown> | null
      if (parsed && typeof parsed.schema === "string") schemaName = parsed.schema
    } catch {}
  }

  const schema = await loadSchema(schemaName, projectDir, {
    exists: async (p) => await fsExists(p),
    readFile: async (p) => await Bun.file(p).text(),
  })

  if (artifactIdOrApply === "apply") {
    return generateApplyInstructions(projectDir, changeName, schema)
  }

  // Get artifact instructions
  const artifact = schema.artifacts.find((a) => a.id === artifactIdOrApply)
  if (!artifact) throw new Error(`Artifact "${artifactIdOrApply}" not found in schema "${schemaName}"`)

  // Check if dependencies are done
  const ctx = await getChangeContext(projectDir, changeName, schemaName)
  const depStates = artifact.requires
    .map((depId) => ctx.artifacts.find((a) => a.id === depId)!)
    .filter(Boolean)

  const missingDeps = depStates.filter((a) => a.status !== "done").map((a) => a.id)

  // Load template
  const template = await loadTemplate(schemaName, artifact.template, projectDir, {
    exists: async (p) => await fsExists(p),
  })

  return {
    artifactId: artifact.id,
    changeName,
    schemaName,
    changeDir: dir,
    outputPath: artifact.generates.includes("*")
      ? path.join(dir, "specs")
      : path.join(dir, artifact.generates),
    description: artifact.description,
    instruction: artifact.instruction,
    context: "This is an OpenSpec change. Follow the artifact guidelines carefully.",
    rules: [
      "Follow the instruction field for this artifact type",
      "Read dependency artifacts before creating new ones",
      "Use template as the structure for your output file",
      "Do NOT copy context or rules into the artifact file",
    ],
    template,
    dependencies: depStates
      .filter((a) => a.status === "done")
      .map((a) => ({ id: a.id, path: path.join(dir, schema.artifacts.find((art) => art.id === a.id)?.generates || "") })),
    unlocks: ctx.artifacts
      .filter((a) => a.status !== "done" && schema.artifacts.find((art) => art.id === a.id)?.requires.includes(artifact.id))
      .map((a) => a.id),
    missingDeps,
  }
}

async function generateApplyInstructions(
  projectDir: string,
  changeName: string,
  schema: SchemaDefinition,
): Promise<Record<string, unknown>> {
  const dir = changeDir(projectDir, changeName)
  const ctx = await getChangeContext(projectDir, changeName, schema.name)

  // Check if apply requirements are met
  const allRequiredDone = schema.apply.requires.every((req) =>
    ctx.artifacts.find((a) => a.id === req)?.status === "done",
  )

  if (!allRequiredDone) {
    const missing = schema.apply.requires.filter(
      (req) => ctx.artifacts.find((a) => a.id === req)?.status !== "done",
    )
    return {
      state: "blocked",
      changeName,
      schemaName: schema.name,
      missingArtifacts: missing,
      message: `Missing artifacts: ${missing.join(", ")}. Create them first.`,
    }
  }

  // Build context files map
  const contextFiles: Record<string, string[]> = {}
  for (const artifact of schema.artifacts) {
    if (artifact.generates.includes("*")) {
      const base = artifact.generates.split("*")[0]!
      const specDir = path.join(dir, base)
      const files: string[] = []
      if (await fsExists(specDir)) {
        const glob = new Bun.Glob("**/*.md")
        for await (const file of glob.scan({ cwd: specDir, absolute: false })) {
          files.push(path.join(dir, base, file))
        }
      }
      if (files.length > 0) contextFiles[artifact.id] = files
    } else {
      const filePath = path.join(dir, artifact.generates)
      if (await fsExists(filePath)) {
        contextFiles[artifact.id] = [filePath]
      }
    }
  }

  // Parse tasks
  const tasksPath = path.join(dir, schema.apply.tracks)
  let tasks: Array<{ id: string; description: string; status: string }> = []
  let total = 0
  let complete = 0

  if (await fsExists(tasksPath)) {
    const raw = await Bun.file(tasksPath).text()
    const lines = raw.split("\n")
    let section = ""
    for (const line of lines) {
      const sectionMatch = line.match(/^##\s+(.+)/)
      if (sectionMatch) {
        section = sectionMatch[1]!.trim()
        continue
      }
      const taskMatch = line.match(/^-\s*\[([ x])\]\s+(.+)/)
      if (taskMatch) {
        total++
        const isComplete = taskMatch[1] === "x"
        if (isComplete) complete++
        tasks.push({
          id: taskMatch[2]!.trim(),
          description: taskMatch[2]!.trim(),
          status: isComplete ? "completed" : "pending",
        })
      }
    }
  }

  if (total === complete && total > 0) {
    return {
      state: "all_done",
      changeName,
      schemaName: schema.name,
      progress: { total, complete, remaining: 0 },
      tasks,
      contextFiles,
    }
  }

  return {
    state: "ready",
    changeName,
    schemaName: schema.name,
    progress: { total, complete, remaining: total - complete },
    tasks,
    contextFiles,
    instruction: schema.apply.instruction,
    tracks: schema.apply.tracks,
  }
}
