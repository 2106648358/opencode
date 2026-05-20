import { For, onMount } from "solid-js"
import { useTheme } from "../../context/theme"
import { usePromptRef } from "../../context/prompt"
import { FLOW_STEPS } from "./config"
import { MOCK_PRDS } from "./config"
import type { PRDContent } from "./config"
import type { PromptInfo } from "../../component/prompt/history"
import * as TemplateFile from "@/template/file"
import * as Repo from "@/template/repo"
import { seedFlowTemplates } from "@/template/seed"
import { Log } from "@/util"
import path from "path"
import { fileURLToPath } from "url"

const log = Log.create({ service: "tui.flow.workflow" })

export function Workflow(props: { prdTitle?: string; prdJsonContent?: PRDContent; prdID?: string; checkedFiles?: Set<string>; repoPath?: string }) {
  const { theme } = useTheme()
  const promptRef = usePromptRef()

  onMount(async () => {
    await seedFlowTemplates(FLOW_STEPS)
    log.info("workflow mounted")
  })

  const handleStepClick = async (step: (typeof FLOW_STEPS)[number], index: number) => {
    log.info("step clicked", { key: step.key, index })

    try {
      const parts: PromptInfo["parts"] = []

      if (index === 0) {
        let input = props.repoPath
          ? `/prd-tech-solution 仓库地址: ${props.repoPath}`
          : "/prd-tech-solution"

        if (props.prdJsonContent) {
          const { f, b } = props.prdJsonContent
          const prdDir = props.prdID ? MOCK_PRDS.find((p) => p.id === props.prdID)?.file : undefined
          const moduleDir = path.dirname(fileURLToPath(import.meta.url))

          const checked = props.checkedFiles
          log.info("injecting files", { checkedFiles: checked ? [...checked] : undefined, prdID: props.prdID })

          const jsonify = (data: object, filename: string) => {
            const jsonStr = JSON.stringify(data)
            const base64 = Buffer.from(jsonStr, "utf-8").toString("base64")
            const absPath = prdDir ? path.join(moduleDir, prdDir, filename) : filename
            const virtualText = `@${absPath}`
            input = `${input}\n${virtualText} `
            const start = input.length - virtualText.length - 1
            parts.push({
              type: "file",
              mime: "text/plain",
              filename,
              url: `data:text/plain;base64,${base64}`,
              source: {
                type: "file" as const,
                path: absPath,
                text: { start, end: start + virtualText.length, value: virtualText },
              },
            })
          }

          if (!props.checkedFiles || props.checkedFiles.has("f")) jsonify(f, "f.json")
          if (!props.checkedFiles || props.checkedFiles.has("b")) jsonify(b, "b.json")
        }

        const ref = promptRef.current
        if (ref) ref.set({ input, parts })
      } else {
        const loaded = await loadTemplateContent(step.templateName)
        let stepContent = loaded ?? step.label

        if (props.repoPath)
          stepContent = `仓库地址: ${props.repoPath}\n\n${stepContent}`

        const ref = promptRef.current
        if (ref) ref.set({ input: stepContent, parts })
      }
    } catch (err) {
      log.error("failed to handle step click", { error: String(err) })
    }
  }

  return (
    <box flexDirection="column">
      <For each={FLOW_STEPS}>
        {(step, index) => (
          <box
            onMouseUp={(evt: any) => {
              evt.stopPropagation()
              handleStepClick(step, index())
            }}
            paddingX={2}
            paddingY={1}
            flexDirection="row"
            gap={1}
          >
            <text fg={theme.textMuted}>→</text>
            <text fg={theme.text}>{step.label}</text>
          </box>
        )}
      </For>
    </box>
  )
}

async function loadTemplateContent(templateName: string): Promise<string | undefined> {
  try {
    const localDir = await getLocalDir()
    const localTemplates = await TemplateFile.listTemplates(localDir)
    const found = localTemplates.find((t) => t.name === templateName)
    if (found) return found.content

    const repos = await Repo.loadRepos()
    for (const repo of repos) {
      const dir = Repo.repoDir(repo)
      const templates = await TemplateFile.listTemplates(dir)
      const hit = templates.find((t) => t.name === templateName)
      if (hit) return hit.content
    }
    return undefined
  } catch (err) {
    log.warn("failed to load template", { templateName, error: String(err) })
    return undefined
  }
}

async function getLocalDir(): Promise<string> {
  const path = await import("path")
  const { Global } = await import("@opencode-ai/core/global")
  return path.join(Global.Path.data, "templates", "local")
}
