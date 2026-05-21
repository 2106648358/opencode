import { parse as parseYaml } from "yaml"
import path from "path"

export type Artifact = {
  id: string
  generates: string
  description: string
  template: string
  instruction: string
  requires: string[]
}

export type Apply = {
  requires: string[]
  tracks: string
  instruction: string
}

export type SchemaDefinition = {
  name: string
  version: number
  description: string
  artifacts: Artifact[]
  apply: Apply
}

export type SchemaInfo = {
  name: string
  description: string
  artifacts: string[]
  source: "builtin" | "project" | "global"
  path: string
}

export const BUILTIN_SCHEMAS_DIR = path.join(import.meta.dirname, "builtin", "schemas")

export function parseSchema(raw: string): SchemaDefinition {
  const parsed = parseYaml(raw) as Record<string, unknown>
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid schema YAML")
  if (typeof parsed.name !== "string") throw new Error("Schema must have a name")
  if (!Array.isArray(parsed.artifacts)) throw new Error("Schema must have artifacts array")
  if (!parsed.apply || typeof parsed.apply !== "object")
    throw new Error("Schema must have apply section")

  const apply = parsed.apply as Record<string, unknown>
  if (!Array.isArray(apply.requires))
    throw new Error("Schema apply must have requires array")
  if (typeof apply.tracks !== "string")
    throw new Error("Schema apply must have tracks")
  if (typeof apply.instruction !== "string")
    throw new Error("Schema apply must have instruction")

  const artifacts: Artifact[] = (parsed.artifacts as Array<Record<string, unknown>>).map((a, i) => {
    if (typeof a.id !== "string") throw new Error(`Artifact ${i} must have id`)
    if (typeof a.generates !== "string") throw new Error(`Artifact ${i} must have generates`)
    if (typeof a.description !== "string") throw new Error(`Artifact ${i} must have description`)
    if (typeof a.template !== "string") throw new Error(`Artifact ${i} must have template`)
    if (typeof a.instruction !== "string") throw new Error(`Artifact ${i} must have instruction`)
    return {
      id: a.id,
      generates: a.generates,
      description: a.description,
      template: a.template,
      instruction: a.instruction,
      requires: Array.isArray(a.requires)
        ? a.requires.filter((r): r is string => typeof r === "string")
        : [],
    }
  })

  return {
    name: parsed.name,
    version: typeof parsed.version === "number" ? parsed.version : 1,
    description: typeof parsed.description === "string" ? parsed.description : "",
    artifacts,
    apply: {
      requires: apply.requires.filter((r): r is string => typeof r === "string"),
      tracks: apply.tracks,
      instruction: apply.instruction,
    },
  }
}

export async function loadSchema(
  schemaName: string,
  projectDir: string,
  fs: { readFile: (p: string) => Promise<string>; exists: (p: string) => Promise<boolean> },
): Promise<SchemaDefinition> {
  // Priority: project-local > builtin
  const projectSchemaPath = path.join(projectDir, ".openspec", "schemas", schemaName, "schema.yaml")
  if (await fs.exists(projectSchemaPath)) {
    return parseSchema(await fs.readFile(projectSchemaPath))
  }

  const builtinSchemaDir = path.join(BUILTIN_SCHEMAS_DIR, schemaName)
  const builtinSchemaPath = path.join(builtinSchemaDir, "schema.yaml")
  const builtinSchemaFile = Bun.file(builtinSchemaPath)
  if (await builtinSchemaFile.exists()) {
    return parseSchema(await builtinSchemaFile.text())
  }

  throw new Error(`Schema "${schemaName}" not found`)
}

export async function loadTemplate(
  schemaName: string,
  templateName: string,
  projectDir: string,
  fs: { exists: (p: string) => Promise<boolean> },
): Promise<string> {
  // Priority: project-local > builtin
  const projectTemplatePath = path.join(
    projectDir,
    ".openspec",
    "schemas",
    schemaName,
    "templates",
    templateName,
  )
  if (await fs.exists(projectTemplatePath)) {
    return Bun.file(projectTemplatePath).text()
  }

  const builtinTemplatePath = path.join(
    BUILTIN_SCHEMAS_DIR,
    schemaName,
    "templates",
    templateName,
  )
  return Bun.file(builtinTemplatePath).text()
}

export async function listSchemas(
  projectDir: string,
  fs: { exists: (p: string) => Promise<boolean>; readdir?: (p: string) => Promise<string[]> },
): Promise<SchemaInfo[]> {
  const schemas: SchemaInfo[] = []

  // Builtin schemas
  const builtinSchemaDir = BUILTIN_SCHEMAS_DIR
  for await (const entry of (Bun.file(builtinSchemaDir) as any)) {
    // This won't work... let me use a different approach
  }
  // Use Glob to scan builtin
  const glob = new Bun.Glob("*/schema.yaml")
  for await (const match of glob.scan({ cwd: builtinSchemaDir, absolute: false })) {
    const name = match.split(path.sep)[0]!
    const schemaPath = path.join(builtinSchemaDir, match)
    const raw = await Bun.file(schemaPath).text()
    const schema = parseSchema(raw)
    if (!schemas.find((s) => s.name === schema.name)) {
      schemas.push({
        name: schema.name,
        description: schema.description,
        artifacts: schema.artifacts.map((a) => a.id),
        source: "builtin",
        path: schemaPath,
      })
    }
  }

  // Project-local schemas
  const projectSchemaDir = path.join(projectDir, ".openspec", "schemas")
  if (await fs.exists(projectSchemaDir)) {
    const projectGlob = new Bun.Glob("*/schema.yaml")
    for await (const match of projectGlob.scan({ cwd: projectSchemaDir, absolute: false })) {
      const name = match.split(path.sep)[0]!
      const schemaPath = path.join(projectSchemaDir, match)
      const raw = await Bun.file(schemaPath).text()
      const schema = parseSchema(raw)
      const idx = schemas.findIndex((s) => s.name === schema.name)
      const info: SchemaInfo = {
        name: schema.name,
        description: schema.description,
        artifacts: schema.artifacts.map((a) => a.id),
        source: "project",
        path: schemaPath,
      }
      if (idx >= 0) schemas[idx] = info
      else schemas.push(info)
    }
  }

  return schemas
}
