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
        <box flexShrink={0} paddingBottom={1} flexDirection="row" justifyContent="space-between">
          <text fg={theme.textMuted}>Sessions</text>
          <text fg={theme.textMuted}>{sessions().length}</text>
        </box>
        <box flexShrink={0} height={1} backgroundColor={theme.border} />
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
          <box flexDirection="column">
            <For each={sessions()}>
              {(s) => {
                const isActive = s.id === props.sessionID
                const status = () => sync.data.session_status?.[s.id]
                const isWorking = status()?.type === "busy"

                return (
                  <box
                    onMouseUp={() => route.navigate({ type: "session", sessionID: s.id })}
                    paddingX={1}
                    paddingY={0}
                    backgroundColor={isActive ? theme.background : undefined}
                    flexDirection="column"
                  >
                    <box flexDirection="row" justifyContent="space-between" alignItems="baseline">
                      <text
                        fg={isActive ? selectedForeground(theme) : theme.text}
                        wrapMode="none"
                      >
                        {s.title || "Untitled"}
                      </text>
                      <Show when={isWorking}>
                        <text fg={theme.textMuted}>...</text>
                      </Show>
                    </box>
                    <text fg={theme.textMuted}>
                      {Locale.todayTimeOrDateTime(s.time.updated)}
                    </text>
                  </box>
                )
              }}
            </For>
          </box>
          <TuiPluginRuntime.Slot name="sidebar_content" session_id={props.sessionID} />
        </scrollbox>

        <box flexShrink={0}>
          <box height={1} backgroundColor={theme.border} marginBottom={1} />
          <text fg={theme.textMuted}>OpenCode {InstallationVersion}</text>
        </box>
      </box>
    </Show>
  )
}
