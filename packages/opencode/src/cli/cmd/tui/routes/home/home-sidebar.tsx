import { useProject } from "@tui/context/project"
import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"
import { createMemo, For, Show } from "solid-js"
import { useTheme } from "../../context/theme"
import { useTuiConfig } from "../../context/tui-config"
import { useKeybind } from "../../context/keybind"
import { Locale } from "@/util"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { getScrollAcceleration } from "../../util/scroll"

export function HomeSidebar(props: { overlay?: boolean }) {
  const sync = useSync()
  const project = useProject()
  const route = useRoute()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const keybind = useKeybind()

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

  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  return (
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
            {(session) => {
              const workspaceStatus = () => {
                const workspaceID = session.workspaceID
                if (!workspaceID) return undefined
                return project.workspace.status(workspaceID) ?? "error"
              }
              const status = () => sync.data.session_status?.[session.id]
              const isWorking = status()?.type === "busy"

              return (
                <box
                  onMouseUp={() => route.navigate({ type: "session", sessionID: session.id })}
                  paddingX={1}
                  paddingY={0}
                  gap={1}
                >
                  <Show when={isWorking}>
                    <text fg={theme.textMuted}>⟳</text>
                  </Show>
                  <Show when={!isWorking && workspaceStatus() !== undefined}>
                    <text fg={workspaceStatus() === "connected" ? theme.success : theme.error}>
                      ●
                    </text>
                  </Show>
                  <Show when={!isWorking && workspaceStatus() === undefined}>
                    <text fg={theme.textMuted}>○</text>
                  </Show>
                  <box flexDirection="column" flexGrow={1} minWidth={0}>
                    <text fg={theme.text}>
                      {session.title || "Untitled"}
                    </text>
                    <text fg={theme.textMuted}>
                      {Locale.todayTimeOrDateTime(session.time.updated)}
                    </text>
                  </box>
                </box>
              )
            }}
          </For>
        </box>
      </scrollbox>

      <box flexShrink={0} paddingTop={1} flexDirection="column">
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.success }}>•</span> <b>Open</b>
          <span style={{ fg: theme.text }}>
            <b>Code</b>
          </span>{" "}
          {InstallationVersion}
        </text>
        <text fg={theme.textMuted}>
          {keybind.print("sidebar_toggle")} toggle · {keybind.print("session_list")} list
        </text>
      </box>
    </box>
  )
}
