import type { CommandModule, Argv } from "yargs"
import {
  listSchemas,
  loadSchema,
  loadTemplate,
} from "../../openspec/schema"
import {
  createChange,
  listChanges,
  archiveChange,
  validateChangeName,
  getDefaultSchema,
  changeDir,
} from "../../openspec/change"
import { getChangeContext, getInstructions } from "../../openspec/artifact-graph"
import path from "path"

const projectDir = () => process.cwd()

export const OpenSpecCommand = {
  command: "openspec",
  describe: "OpenSpec workflow management",
  builder(yargs: Argv) {
    return yargs
      .command(
        "new change <name>",
        "Create a new change directory",
        (y: Argv) =>
          y
            .positional("name", { type: "string", demandOption: true, describe: "Change name (kebab-case)" })
            .option("schema", { type: "string", describe: "Workflow schema to use", default: "spec-driven" })
            .option("description", { type: "string", describe: "Description for the change" }),
        async (args: any) => {
          try {
            const schemaName = (args.schema as string) || (await getDefaultSchema(projectDir()))
            const result = await createChange(projectDir(), args.name as string, schemaName, args.description as string)
            console.log(JSON.stringify(result))
          } catch (e: any) {
            console.error(e.message)
            process.exit(1)
          }
        },
      )
      .command(
        "list",
        "List changes",
        (y: Argv) => y.option("json", { type: "boolean", describe: "Output as JSON" }).option("specs", { type: "boolean", describe: "List specs instead of changes" }),
        async (args: any) => {
          try {
            const changes = await listChanges(projectDir())
            if (args.json) {
              console.log(JSON.stringify(changes))
            } else {
              for (const c of changes) {
                const progress = c.taskProgress ? ` (${c.taskProgress.complete}/${c.taskProgress.total})` : ""
                console.log(`${c.name} [${c.schema}]${progress}`)
              }
              if (changes.length === 0) console.log("No active changes")
            }
          } catch (e: any) {
            console.error(e.message)
            process.exit(1)
          }
        },
      )
      .command(
        "status",
        "Show artifact completion status for a change",
        (y: Argv) =>
          y.option("change", { type: "string", demandOption: true, describe: "Change name" }).option("json", {
            type: "boolean",
            describe: "Output as JSON",
          }),
        async (args: any) => {
          try {
            const ctx = await getChangeContext(projectDir(), args.change as string, "spec-driven")
            if (args.json) {
              console.log(JSON.stringify(ctx))
            } else {
              console.log(`Change: ${ctx.changeName}`)
              console.log(`Schema: ${ctx.schemaName}`)
              console.log()
              for (const artifact of ctx.artifacts) {
                const icon = artifact.status === "done" ? "✓" : artifact.status === "ready" ? "○" : "✗"
                console.log(`${icon} ${artifact.id}: ${artifact.status}${artifact.missingDeps.length > 0 ? ` (needs: ${artifact.missingDeps.join(", ")})` : ""}`)
              }
              console.log()
              console.log(`Progress: ${ctx.artifacts.filter((a) => a.status === "done").length}/${ctx.artifacts.length} artifacts complete`)
              console.log(`Apply ready: ${ctx.isComplete ? "yes" : "no"}`)
            }
          } catch (e: any) {
            console.error(e.message)
            process.exit(1)
          }
        },
      )
      .command(
        "instructions <artifact>",
        "Output instructions for an artifact or apply",
        (y: Argv) =>
          y
            .positional("artifact", { type: "string", demandOption: true, describe: "Artifact ID or 'apply'" })
            .option("change", { type: "string", demandOption: true, describe: "Change name" })
            .option("json", { type: "boolean", describe: "Output as JSON" }),
        async (args: any) => {
          try {
            const instructions = await getInstructions(
              projectDir(),
              args.change as string,
              args.artifact as string,
            )
            if (args.json) {
              console.log(JSON.stringify(instructions, null, 2))
            } else {
              console.log(JSON.stringify(instructions, null, 2))
            }
          } catch (e: any) {
            console.error(e.message)
            process.exit(1)
          }
        },
      )
      .command(
        "archive <name>",
        "Archive a completed change",
        (y: Argv) =>
          y
            .positional("name", { type: "string", demandOption: true, describe: "Change name" })
            .option("yes", { type: "boolean", describe: "Skip confirmation" }),
        async (args: any) => {
          try {
            const archiveName = await archiveChange(projectDir(), args.name as string)
            console.log(`Archived: ${archiveName}`)
          } catch (e: any) {
            console.error(e.message)
            process.exit(1)
          }
        },
      )
      .command(
        "schema <subcommand> [args..]",
        "Manage workflow schemas",
        (y: Argv) =>
          y
            .command("list", "List available schemas",
              (sy: Argv) => sy.option("json", { type: "boolean", describe: "Output as JSON" }),
              async (sargs: any) => {
                try {
                  const schemas = await listSchemas(projectDir(), {
                    exists: async (p: string) => await Bun.file(p).exists(),
                  })
                  if (sargs.json) console.log(JSON.stringify(schemas))
                  else for (const s of schemas) console.log(`${s.name} [${s.source}]: ${s.description}`)
                } catch (e: any) { console.error(e.message); process.exit(1) }
              })
            .command("fork <source> [name]", "Copy a schema to project for customization",
              (sy: Argv) => sy.positional("source", { type: "string", demandOption: true }).positional("name", { type: "string" }).option("force", { type: "boolean" }),
              async (sargs: any) => {
                try {
                  const fromName = sargs.source as string
                  const toName = (sargs.name as string) || fromName
                  const destDir = path.join(projectDir(), ".openspec", "schemas", toName)
                  const schema = await loadSchema(fromName, projectDir(), {
                    exists: async (p: string) => await Bun.file(p).exists(),
                    readFile: async (p: string) => await Bun.file(p).text(),
                  })
                  if (await Bun.file(path.join(destDir, "schema.yaml")).exists() && !sargs.force)
                    throw new Error(`Schema "${toName}" already exists. Use --force.`)
                  await Bun.write(path.join(destDir, "schema.yaml"),
                    (await Bun.file(path.join(import.meta.dirname, "..", "..", "openspec", "builtin", "schemas", fromName, "schema.yaml")).text()).replace(/^name:.*/m, `name: ${toName}`))
                  for (const artifact of schema.artifacts) {
                    const tpl = await loadTemplate(fromName, artifact.template, projectDir(), { exists: async (p: string) => await Bun.file(p).exists() })
                    await Bun.write(path.join(destDir, "templates", artifact.template), tpl)
                  }
                  console.log(`Schema "${toName}" created at ${destDir}`)
                } catch (e: any) { console.error(e.message); process.exit(1) }
              })
            .command("init <name>", "Create a new project-local schema",
              (sy: Argv) => sy.positional("name", { type: "string", demandOption: true }).option("description", { type: "string" }).option("artifacts", { type: "string" }).option("default", { type: "boolean" }).option("force", { type: "boolean" }),
              async (sargs: any) => {
                try {
                  const schemaName = sargs.name as string
                  const destDir = path.join(projectDir(), ".openspec", "schemas", schemaName)
                  if (await Bun.file(path.join(destDir, "schema.yaml")).exists() && !sargs.force)
                    throw new Error(`Schema "${schemaName}" already exists. Use --force.`)
                  const desc = (sargs.description as string) || `Custom schema: ${schemaName}`
                  const ids = (sargs.artifacts as string) ? (sargs.artifacts as string).split(",").map((s: string) => s.trim()) : ["proposal", "design", "tasks"]
                  const artifactsYaml = ids.map((id: string, i: number) =>
                    `  - id: ${id}\n    generates: ${id}.md\n    description: ${id} document\n    template: ${id}.md\n    instruction: Create the ${id} document.\n    requires: [${ids.slice(0, i).join(", ")}]`).join("\n")
                  const applyReq = ids.length > 0 ? [ids[ids.length - 1]!] : []
                  await Bun.write(path.join(destDir, "schema.yaml"),
                    `name: ${schemaName}\nversion: 1\ndescription: ${desc}\nartifacts:\n${artifactsYaml}\napply:\n  requires: [${applyReq.join(", ")}]\n  tracks: ${applyReq[0] || "tasks"}.md\n  instruction: Read context files, work through tasks, mark complete as you go.\n`)
                  for (const id of ids) await Bun.write(path.join(destDir, "templates", `${id}.md`), `## ${id}\n`)
                  if (sargs.default) await Bun.write(path.join(projectDir(), "openspec", "config.yaml"), `schema: ${schemaName}\n`)
                  console.log(`Schema "${schemaName}" created`)
                } catch (e: any) { console.error(e.message); process.exit(1) }
              })
            .command("validate [name]", "Validate a schema",
              (sy: Argv) => sy.positional("name", { type: "string" }).option("verbose", { type: "boolean" }),
              async (sargs: any) => {
                try {
                  const schema = await loadSchema((sargs.name as string) || "spec-driven", projectDir(), {
                    exists: async (p: string) => await Bun.file(p).exists(),
                    readFile: async (p: string) => await Bun.file(p).text(),
                  })
                  console.log(`Schema "${schema.name}" valid. Version: ${schema.version}. Artifacts: ${schema.artifacts.map((a: any) => a.id).join(" → ")}`)
                } catch (e: any) { console.error(e.message); process.exit(1) }
              })
            .command("templates", "Show template paths", (sy: Argv) => sy.option("schema", { type: "string", demandOption: true }).option("json", { type: "boolean" }),
              async (sargs: any) => {
                try {
                  const schema = await loadSchema(sargs.schema as string, projectDir(), {
                    exists: async (p: string) => await Bun.file(p).exists(),
                    readFile: async (p: string) => await Bun.file(p).text(),
                  })
                  const result: Record<string, { path: string; source: string }> = {}
                  for (const artifact of schema.artifacts) {
                    const tplPath = path.join(projectDir(), ".openspec", "schemas", sargs.schema as string, "templates", artifact.template)
                    result[artifact.id] = { path: tplPath, source: (await Bun.file(tplPath).exists()) ? "project" : "builtin" }
                  }
                  console.log(sargs.json ? JSON.stringify(result) : Object.entries(result).map(([k, v]) => `${k}: ${v.path} [${v.source}]`).join("\n"))
                } catch (e: any) { console.error(e.message); process.exit(1) }
              })
      )
      .command("init", "Initialize OpenSpec in the project", () => {}, async () => {
        const dirs = ["openspec", "openspec/specs", "openspec/changes", "openspec/changes/archive"]
        for (const d of dirs) {
          const p = path.join(projectDir(), d)
          if (!(await Bun.file(path.join(p, ".gitkeep")).exists())) await Bun.write(path.join(p, ".gitkeep"), "")
        }
        const c = path.join(projectDir(), "openspec", "config.yaml")
        if (!(await Bun.file(c).exists())) await Bun.write(c, "schema: spec-driven\n")
        console.log("OpenSpec initialized.")
      })
      .command("update", "Update OpenSpec instruction files", () => {}, () => {
        console.log("Skills are built into OpenCode. No update needed.")
      })
      .demandCommand(1, "Subcommand required")
  },
  handler: () => {},
} satisfies CommandModule
