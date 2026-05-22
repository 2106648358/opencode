import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "@tui/ui/dialog"
import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"
import { For, Show, createMemo } from "solid-js"

type FileEntry = {
  file: string
  additions: number
  deletions: number
}

type ModelStats = {
  agent: string
  providerID: string
  modelID: string
  total_additions: number
  total_deletions: number
  files: FileEntry[]
}

export function DialogStats() {
  const sync = useSync()
  const { theme } = useTheme()
  const dialog = useDialog()
  const route = useRoute()

  const sessionID = createMemo(() =>
    route.data.type === "session" ? route.data.sessionID : null,
  )

  const stats = createMemo(() => {
    const sid = sessionID()
    if (!sid) return []
    const messages = sync.data.message[sid] ?? []
    const fileStats: Array<{ file: string; additions: number; deletions: number; agent: string; providerID: string; modelID: string }> = []
    for (const msg of messages) {
      if (msg.role !== "user") continue
      if (!msg.summary?.diffs?.length) continue
      for (const diff of msg.summary.diffs) {
        fileStats.push({
          file: diff.file,
          additions: diff.additions,
          deletions: diff.deletions,
          agent: msg.agent,
          providerID: msg.model.providerID,
          modelID: msg.model.modelID,
        })
      }
    }
    const byModel = new Map<string, ModelStats>()
    for (const fs of fileStats) {
      const key = `${fs.agent}/${fs.providerID}/${fs.modelID}`
      const existing = byModel.get(key)
      if (existing) {
        existing.total_additions += fs.additions
        existing.total_deletions += fs.deletions
        const idx = existing.files.findIndex((f) => f.file === fs.file)
        if (idx >= 0) {
          existing.files[idx] = {
            file: fs.file,
            additions: existing.files[idx].additions + fs.additions,
            deletions: existing.files[idx].deletions + fs.deletions,
          }
        } else {
          existing.files.push({ file: fs.file, additions: fs.additions, deletions: fs.deletions })
        }
      } else {
        byModel.set(key, {
          agent: fs.agent,
          providerID: fs.providerID,
          modelID: fs.modelID,
          total_additions: fs.additions,
          total_deletions: fs.deletions,
          files: [{ file: fs.file, additions: fs.additions, deletions: fs.deletions }],
        })
      }
    }
    return Array.from(byModel.values())
  })

  const grandTotal = createMemo(() => {
    const s = stats()
    return {
      additions: s.reduce((sum, m) => sum + m.total_additions, 0),
      deletions: s.reduce((sum, m) => sum + m.total_deletions, 0),
      files: s.reduce((sum, m) => sum + m.files.length, 0),
    }
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Code Generation Statistics
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <Show
        when={sessionID()}
        fallback={<text fg={theme.textMuted}>Open a session to view code generation statistics</text>}
      >
        <Show
          when={stats().length > 0}
          fallback={<text fg={theme.textMuted}>No file changes recorded in this session</text>}
        >
          <box gap={1}>
            <box flexDirection="row" gap={2}>
              <text fg={theme.textMuted}>
                <span style={{ fg: theme.diffAdded }}>+{grandTotal().additions}</span>
                {" / "}
                <span style={{ fg: theme.diffRemoved }}>-{grandTotal().deletions}</span>
                {" across "}
                {grandTotal().files} files
              </text>
            </box>
            <For each={stats()}>
              {(model) => (
                <box gap={1}>
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.text}>
                      <b>{model.agent}</b>
                      <span style={{ fg: theme.textMuted }}> / {model.providerID}/{model.modelID}</span>
                    </text>
                    <text>
                      <span style={{ fg: theme.diffAdded }}>+{model.total_additions}</span>
                      <span style={{ fg: theme.textMuted }}> </span>
                      <span style={{ fg: theme.diffRemoved }}>-{model.total_deletions}</span>
                    </text>
                  </box>
                  <For each={model.files}>
                    {(file) => (
                      <box flexDirection="row" gap={1} paddingLeft={2}>
                        <text fg={theme.textMuted} wrapMode="none">
                          {file.file}
                        </text>
                        <box flexDirection="row" gap={1} flexShrink={0}>
                          <Show when={file.additions > 0}>
                            <text fg={theme.diffAdded}>+{file.additions}</text>
                          </Show>
                          <Show when={file.deletions > 0}>
                            <text fg={theme.diffRemoved}>-{file.deletions}</text>
                          </Show>
                        </box>
                      </box>
                    )}
                  </For>
                </box>
              )}
            </For>
          </box>
        </Show>
      </Show>
    </box>
  )
}
