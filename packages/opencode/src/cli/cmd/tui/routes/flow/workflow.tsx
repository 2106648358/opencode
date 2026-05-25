import { For } from "solid-js"
import { useTheme } from "../../context/theme"
import { usePromptRef } from "../../context/prompt"
import { FLOW_STEPS } from "./config"
import { MOCK_PRDS } from "./config"
import type { PRDContent } from "./config"
import type { PromptInfo } from "../../component/prompt/history"
import { Log } from "@/util"
import path from "path"

const log = Log.create({ service: "tui.flow.workflow" })

export function Workflow(props: { prdTitle?: string; prdJsonContent?: PRDContent; prdID?: string; checkedFiles?: Set<string>; repoPath?: string }) {
  const { theme } = useTheme()
  const promptRef = usePromptRef()

  const handleStepClick = async (step: (typeof FLOW_STEPS)[number], index: number) => {
    log.info("step clicked", { key: step.key, index })

    try {
      const parts: PromptInfo["parts"] = []
      let input = step.skillContent

      const prdDir = props.prdID ? MOCK_PRDS.find((p) => p.id === props.prdID)?.file : undefined

      const jsonify = (data: object, filename: string) => {
        const jsonStr = JSON.stringify(data)
        const base64 = Buffer.from(jsonStr, "utf-8").toString("base64")
        const absPath = prdDir ? path.posix.join("packages/opencode/src/cli/cmd/tui/routes/flow", prdDir, filename) : filename
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

      if (index === 0) {
        if (props.repoPath) {
          input = `${input}\n\n## 仓库地址\n${props.repoPath}`
        }

        if (props.prdJsonContent && props.prdID) {
          const { f, b } = props.prdJsonContent
          if (!props.checkedFiles || props.checkedFiles.has("f")) jsonify(f, "f.json")
          if (!props.checkedFiles || props.checkedFiles.has("b")) jsonify(b, "b.json")
        }
      } else if (index === 1) {
        input = `${input}\n\n根据技术方案文档中的\n##前端完整 f.json\n##接口设计\n生成前端所有工件`
        if (props.prdJsonContent) jsonify(props.prdJsonContent.f, "f.json")
      } else if (index === 2) {
        input = `${input}\n\n根据技术文档的 后端技术方案 生成后端所有工件`
        if (props.prdJsonContent) jsonify(props.prdJsonContent.b, "b.json")
        if (props.prdID) {
          const docName = `PRD-${props.prdID.padStart(3, "0")}-backend-technical-solution.md`
          try {
            const docPath = path.join(process.cwd(), docName)
            const docContent = await Bun.file(docPath).text()
            if (docContent) {
              const base64 = Buffer.from(docContent, "utf-8").toString("base64")
              const virtualText = `@${docName}`
              input = `${input}\n${virtualText} `
              const start = input.length - virtualText.length - 1
              parts.push({
                type: "file",
                mime: "text/plain",
                filename: docName,
                url: `data:text/plain;base64,${base64}`,
                source: {
                  type: "file" as const,
                  path: docPath,
                  text: { start, end: start + virtualText.length, value: virtualText },
                },
              })
            }
          } catch {
            log.warn("tech solution doc not found", { name: docName })
          }
        }
      } else if (index === 3) {
        if (props.prdJsonContent) jsonify(props.prdJsonContent.b, "b.json")
        if (props.prdID) {
          const docName = `PRD-${props.prdID.padStart(3, "0")}-backend-technical-solution.md`
          try {
            const docPath = path.join(process.cwd(), docName)
            const docContent = await Bun.file(docPath).text()
            if (docContent) {
              const base64 = Buffer.from(docContent, "utf-8").toString("base64")
              const virtualText = `@${docName}`
              input = `${input}\n${virtualText} `
              const start = input.length - virtualText.length - 1
              parts.push({
                type: "file",
                mime: "text/plain",
                filename: docName,
                url: `data:text/plain;base64,${base64}`,
                source: {
                  type: "file" as const,
                  path: docPath,
                  text: { start, end: start + virtualText.length, value: virtualText },
                },
              })
            }
          } catch {
            log.warn("tech solution doc not found", { name: docName })
          }
        }
      } else if (index === 4) {
      }

      const ref = promptRef.current
      if (ref) ref.set({ input, parts })
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
