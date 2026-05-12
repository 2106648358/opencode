import { createMemo, For, createSignal, onMount } from "solid-js"
import { useTheme, selectedForeground } from "../../context/theme"
import { usePromptRef } from "../../context/prompt"
import { FLOW_STEPS } from "./config"
import type { FlowStep } from "./config"
import * as TemplateFile from "@/template/file"
import * as Repo from "@/template/repo"
import { seedFlowTemplates } from "@/template/seed"
import { Log } from "@/util"

const log = Log.create({ service: "tui.flow.workflow" })

export function Workflow(props: { prdTitle?: string; repoPath?: string }) {
  const { theme } = useTheme()
  const promptRef = usePromptRef()
  const [activeStep, setActiveStep] = createSignal(0)
  const [completed, setCompleted] = createSignal<Set<number>>(new Set())
  const [templateStatus, setTemplateStatus] = createSignal<Record<string, boolean>>({})

  onMount(async () => {
    await seedFlowTemplates(FLOW_STEPS)
    const status: Record<string, boolean> = {}
    for (const step of FLOW_STEPS) {
      const content = await loadTemplateContent(step.templateName)
      status[step.key] = content !== undefined
    }
    setTemplateStatus(status)
    log.info("workflow mounted, template status", { status })
  })

  const handleStepClick = async (step: FlowStep, index: number) => {
    if (index !== activeStep()) return

    try {
      const loaded = await loadTemplateContent(step.templateName)
      let promptContent = loaded ?? step.label

      if (props.prdTitle || props.repoPath) {
        const contextParts: string[] = []
        if (props.prdTitle) contextParts.push(`PRD: ${props.prdTitle}`)
        if (props.repoPath) contextParts.push(`仓库地址: ${props.repoPath}`)
        promptContent = `${contextParts.join("\n")}\n\n${promptContent}`
      }

      const ref = promptRef.current
      if (ref) {
        ref.set({ input: promptContent, parts: [] })
      }

      const next = index + 1
      if (next < FLOW_STEPS.length) {
        setActiveStep(next)
        setCompleted((prev) => new Set(prev).add(index))
      } else {
        setCompleted((prev) => new Set(prev).add(index))
      }
    } catch (err) {
      log.error("failed to handle step click", { error: String(err) })
    }
  }

  const stepColors = createMemo(() => {
    return FLOW_STEPS.map((_, i) => {
      if (i === activeStep()) return selectedForeground(theme)
      if (completed().has(i)) return theme.textMuted
      return theme.textMuted
    })
  })

  const stepIndicators = createMemo(() => {
    return FLOW_STEPS.map((_, i) => {
      if (i === activeStep()) return "●"
      if (completed().has(i)) return "✓"
      return "○"
    })
  })

  return (
    <box flexDirection="column" paddingTop={2} paddingBottom={2}>
      <box paddingBottom={1}>
        <text fg={theme.text}>
          <b>Workflow</b>
        </text>
        <text fg={theme.textMuted}> (select step to inject prompt)</text>
      </box>
      <box height={1} backgroundColor={theme.border} />
      <For each={FLOW_STEPS}>
        {(step, index) => {
          const isActive = createMemo(() => index() === activeStep())
          const isDone = createMemo(() => completed().has(index()))
          const hasTemplate = createMemo(() => templateStatus()[step.key] ?? false)

          return (
            <box
              onMouseUp={() => handleStepClick(step, index())}
              paddingX={1}
              paddingY={0}
              flexDirection="row"
              gap={1}
              backgroundColor={isActive() ? theme.backgroundElement : undefined}
            >
              <text fg={stepColors()[index()]}>{stepIndicators()[index()]}</text>
              <text fg={hasTemplate() ? theme.success : theme.textMuted}>
                {hasTemplate() ? "✓" : "✗"}
              </text>
              <text fg={isActive() ? selectedForeground(theme) : stepColors()[index()]}>
                {step.label}
              </text>
            </box>
          )
        }}
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
