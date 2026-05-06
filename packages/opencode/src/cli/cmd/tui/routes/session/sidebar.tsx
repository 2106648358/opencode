import type { InputRenderable } from "@opentui/core"
import { useProject } from "@tui/context/project"
import { useSync } from "@tui/context/sync"
import { createMemo, createSignal, Show, For } from "solid-js"
import { useTheme } from "../../context/theme"
import { useTuiConfig } from "../../context/tui-config"
import { InstallationChannel, InstallationVersion } from "@opencode-ai/core/installation/version"
import { TuiPluginRuntime } from "../../plugin"
import { useCommandDialog } from "../../component/dialog-command"
import { useKeyboard } from "@opentui/solid"
import * as fuzzysort from "fuzzysort"
import { entries, groupBy, pipe } from "remeda"

import { getScrollAcceleration } from "../../util/scroll"

export function Sidebar(props: { sessionID: string; overlay?: boolean }) {
  const project = useProject()
  const sync = useSync()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const session = createMemo(() => sync.session.get(props.sessionID))
  const workspaceStatus = () => {
    const workspaceID = session()?.workspaceID
    if (!workspaceID) return "error"
    return project.workspace.status(workspaceID) ?? "error"
  }
  const workspaceLabel = () => {
    const workspaceID = session()?.workspaceID
    if (!workspaceID) return "unknown"
    const info = project.workspace.get(workspaceID)
    if (!info) return "unknown"
    return `${info.type}: ${info.name}`
  }
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  const commandDialog = useCommandDialog()
  const [search, setSearch] = createSignal("")
  let inputRef: InputRenderable | undefined

  const searchResults = createMemo(() => {

    const query = search()
    if (!query) return [] as import("../../component/dialog-command").CommandOption[]
    const needle = query.toLowerCase()
    const options = commandDialog.visibleOptions()
    return fuzzysort
      .go(needle, options, {
        keys: ["title", "category"],
        scoreFn: (r) => r[0].score * 2 + r[1].score,
      })
      .map((x) => x.obj)
  })

  const searchGrouped = createMemo(() => {
    const results = searchResults()
    if (results.length === 0) return [] as [string, import("../../component/dialog-command").CommandOption[]][]
    return pipe(
      results,
      groupBy((x: import("../../component/dialog-command").CommandOption) => x.category ?? ""),
      entries(),
    )
  })

  useKeyboard((evt) => {
    if (search() && evt.name === "escape") {
      evt.preventDefault()
      setSearch("")
    }
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
          <box flexShrink={0} gap={1} paddingRight={1}>
            <TuiPluginRuntime.Slot
              name="sidebar_title"
              mode="single_winner"
              session_id={props.sessionID}
              title={session()!.title}
              share_url={session()!.share?.url}
            >
              <box paddingRight={1}>
                <text fg={theme.text}>
                  <b>{session()!.title}</b>
                </text>
                <Show when={InstallationChannel !== "latest"}>
                  <text fg={theme.textMuted}>{props.sessionID}</text>
                </Show>
                <Show when={session()!.workspaceID}>
                  <text fg={theme.textMuted}>
                    <span style={{ fg: workspaceStatus() === "connected" ? theme.success : theme.error }}>●</span>{" "}
                    {workspaceLabel()}
                  </text>
                </Show>
                <Show when={session()!.share?.url}>
                  <text fg={theme.textMuted}>{session()!.share!.url}</text>
                </Show>
              </box>
            </TuiPluginRuntime.Slot>

            <input
              placeholder="Search commands..."
              placeholderColor={theme.textMuted}
              onInput={(v) => setSearch(v)}
              focusedBackgroundColor={theme.background}
              focusedTextColor={theme.text}
              ref={(r) => {
                inputRef = r
                setTimeout(() => {
                  if (!inputRef || inputRef.isDestroyed) return
                  inputRef.focus()
                }, 1)
              }}
            />

            <Show when={!search()} fallback={
              <Show when={searchGrouped().length > 0} fallback={
                <text fg={theme.textMuted}>No results found</text>
              }>
                <For each={searchGrouped()}>
                  {([category, options]) => (
                    <>
                      <text fg={theme.textMuted}>{category}</text>
                      <For each={options}>
                        {(option) => (
                          <text
                            fg={theme.text}
                            onMouseUp={() => {
                              commandDialog.trigger(option.value)
                              setSearch("")
                            }}
                          >
                            {option.title}
                          </text>
                        )}
                      </For>
                    </>
                  )}
                </For>
              </Show>
            }>
              <TuiPluginRuntime.Slot name="sidebar_content" session_id={props.sessionID} />
            </Show>
          </box>
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
