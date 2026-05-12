import { createMemo, For, createSignal } from "solid-js"
import { useTheme, selectedForeground } from "../../context/theme"
import { usePromptRef } from "../../context/prompt"
import { FLOW_STEPS } from "./config"
import type { FlowStep } from "./config"
import * as TemplateFile from "@/template/file"
import * as Repo from "@/template/repo"
import { Log } from "@/util"

const log = Log.create({ service: "tui.flow.workflow" })

export function Workflow() {
  const { theme } = useTheme()
  const promptRef = usePromptRef()
  const [activeStep, setActiveStep] = createSignal(0)
  const [completed, setCompleted] = createSignal<Set<number>>(new Set())

  const handleStepClick = async (step: FlowStep, index: number) => {
    if (index !== activeStep()) return

    try {
      const loaded = await loadTemplateContent(step.templateName)
      const promptContent = loaded ?? step.label

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
    const repos = await Repo.loadRepos()
    for (const repo of repos) {
      const dir = Repo.repoDir(repo)
      const templates = await TemplateFile.listTemplates(dir)
      const found = templates.find((t) => t.name === templateName)
      if (found) return found.content
    }
    return undefined
  } catch (err) {
    log.warn("failed to load template", { templateName, error: String(err) })
    return undefined
  }
}
