import { useProject } from "@tui/context/project"
import { useSync } from "@tui/context/sync"
import { createMemo, For, Show } from "solid-js"
import { useTheme, selectedForeground } from "../../context/theme"
import { useTuiConfig } from "../../context/tui-config"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { TuiPluginRuntime } from "../../plugin"
import { useRoute } from "@tui/context/route"
import { Locale } from "@/util"

import { getScrollAcceleration } from "../../util/scroll"

export function Sidebar(props: { sessionID: string; overlay?: boolean }) {
  const project = useProject()
  const sync = useSync()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const route = useRoute()
  const session = createMemo(() => sync.session.get(props.sessionID))
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  const sessions = createMemo(() => {
    return sync.data.session
      .filter((x) => x.parentID === undefined)
      .toSorted((a, b) => {
        const dayA = new Date(b.time.updated).setHours(0, 0, 0, 0)
        const dayB = new Date(a.time.updated).setHours(0, 0, 0, 0)
        if (dayA !== dayB) return dayA - dayB
        return b.time.created - a.time.created
      })
      .slice(0, 50)
  })

  return (
    <Show when={session()}>
      <box
        backgroundColor={theme.backgroundPanel}
        width={42}
        height="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        position={props.overlay ? "absolute" : "relative"}
      >
        <box flexShrink={0} paddingBottom={1}>
          <text fg={theme.text} bold>
            Sessions
          </text>
          <text fg={theme.textMuted}> ({sessions().length})</text>
        </box>
        <scrollbox
          flexGrow={1}
          scrollAcceleration={scrollAcceleration()}
          verticalScrollbarOptions={{
            trackOptions: {
              backgroundColor: theme.background,
              foregroundColor: theme.borderActive,
            },
          }}
        >
          <box flexDirection="column" paddingRight={1}>
            <For each={sessions()}>
              {(s) => {
                const wsStatus = () => {
                  const id = s.workspaceID
                  if (!id) return undefined
                  return project.workspace.status(id) ?? "error"
                }
                const status = () => sync.data.session_status?.[s.id]
                const isWorking = status()?.type === "busy"
                const isActive = s.id === props.sessionID

                return (
                  <box
                    onMouseUp={() => route.navigate({ type: "session", sessionID: s.id })}
                    paddingX={1}
                    paddingY={0}
                    gap={0}
                    flexDirection="column"
                  >
                    <box flexDirection="row" gap={0}>
                      <text fg={isActive ? selectedForeground(theme) : undefined}>
                        {isActive ? "◼  " : "   "}
                      </text>
                      <Show when={isWorking}>
                        <text fg={theme.textMuted}>{"⟳  "}</text>
                      </Show>
                      <Show when={!isWorking && wsStatus() !== undefined}>
                        <text fg={wsStatus() === "connected" ? theme.success : theme.error}>
                          {"■  "}
                        </text>
                      </Show>
                      <Show when={!isWorking && wsStatus() === undefined}>
                        <text fg={theme.textMuted}>{"□  "}</text>
                      </Show>
                      <text fg={theme.text} wrapMode="none">
                        {s.title || "Untitled"}
                      </text>
                    </box>
                    <box flexDirection="row" justifyContent="flex-end">
                      <text fg={theme.textMuted}>
                        {Locale.todayTimeOrDateTime(s.time.updated)}
                      </text>
                    </box>
                  </box>
                )
              }}
            </For>
          </box>
          <TuiPluginRuntime.Slot name="sidebar_content" session_id={props.sessionID} />
        </scrollbox>

        <box flexShrink={0} gap={1} paddingTop={1}>
          <TuiPluginRuntime.Slot name="sidebar_footer" mode="single_winner" session_id={props.sessionID}>
            <text fg={theme.textMuted}>
              <span style={{ fg: theme.success }}>•</span> <b>Open</b>
              <span style={{ fg: theme.text }}>
                <b>Code</b>
              </span>{" "}
              <span>{InstallationVersion}</span>
            </text>
          </TuiPluginRuntime.Slot>
        </box>
      </box>
    </Show>
  )
}
