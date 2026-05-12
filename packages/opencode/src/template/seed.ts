import path from "path"
import { Global } from "@opencode-ai/core/global"
import { Log } from "../util"
import * as TemplateFile from "./file"
import type { FlowStep } from "../cli/cmd/tui/routes/flow/config"

const log = Log.create({ service: "template.seed" })

export async function seedFlowTemplates(steps: FlowStep[]) {
  const localDir = path.join(Global.Path.data, "templates", "local")
  for (const step of steps) {
    try {
      const templates = await TemplateFile.listTemplates(localDir)
      const exists = templates.some((t) => t.name === step.templateName)
      if (exists) continue
      await TemplateFile.createTemplate(localDir, step.templateName, step.label, step.label)
      log.info("seeded flow template", { name: step.templateName })
    } catch (err) {
      log.warn("failed to seed flow template", { name: step.templateName, error: String(err) })
    }
  }
}
