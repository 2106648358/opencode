import { TextAttributes } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { createMemo, createSignal, For, Show } from "solid-js"
import { useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { selectedForeground, useTheme } from "@tui/context/theme"
import { useTuiConfig } from "@tui/context/tui-config"
import { Locale } from "@/util"
import { getScrollAcceleration } from "../util/scroll"

export function HomeSessionList() {
  const sync = useSync()
  const route = useRoute()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const dimensions = useTerminalDimensions()
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))
  const [selected, setSelected] = createSignal(0)

  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  const options = createMemo(() => {
    return sync.data.session
      .filter((x) => !x.parentID)
      .toSorted((a, b) => {
        const aDay = new Date(a.time.updated).setHours(0, 0, 0, 0)
        const bDay = new Date(b.time.updated).setHours(0, 0, 0, 0)
        if (bDay !== aDay) return bDay - aDay
        return b.time.created - a.time.created
      })
      .map((x) => {
        const date = new Date(x.time.updated)
        let category = date.toDateString()
        if (category === today) category = "Today"
        else if (category === yesterday) category = "Yesterday"
        return {
          title: x.title,
          value: x.id,
          category,
        }
      })
  })

  const grouped = createMemo(() => {
    const groups: { category: string; items: ReturnType<typeof options> }[] = []
    for (const opt of options()) {
      const last = groups[groups.length - 1]
      if (last && last.category === opt.category) {
        last.items.push(opt)
      } else {
        groups.push({ category: opt.category, items: [opt] })
      }
    }
    return groups
  })

  const flat = createMemo(() => options())

  const selectedSession = createMemo(() => flat()[selected()])

  function move(dir: number) {
    const items = flat()
    if (items.length === 0) return
    let next = selected() + dir
    if (next < 0) next = items.length - 1
    if (next >= items.length) next = 0
    setSelected(next)
  }

  function select() {
    const item = selectedSession()
    if (!item) return
    route.navigate({ type: "session", sessionID: item.value })
  }

  useKeyboard((evt) => {
    if (evt.defaultPrevented) return
    if (evt.name === "up") {
      evt.preventDefault()
      move(-1)
    }
    if (evt.name === "down") {
      evt.preventDefault()
      move(1)
    }
    if (evt.name === "pageup") {
      evt.preventDefault()
      move(-10)
    }
    if (evt.name === "pagedown") {
      evt.preventDefault()
      move(10)
    }
    if (evt.name === "home") {
      evt.preventDefault()
      setSelected(0)
    }
    if (evt.name === "end") {
      evt.preventDefault()
      setSelected(flat().length - 1)
    }
    if (evt.name === "return") {
      evt.preventDefault()
      select()
    }
  })

  const narrow = () => dimensions().width < 100

  return (
    <Show when={!narrow()}>
      <box
        backgroundColor={theme.backgroundPanel}
        width={32}
        height="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={1}
        flexShrink={0}
      >
        <box flexGrow={1} flexDirection="column" gap={1}>
          <box paddingLeft={1} paddingBottom={1}>
            <text fg={theme.text} attributes={TextAttributes.BOLD}>
              Sessions
            </text>
          </box>
          <Show
            when={flat().length > 0}
            fallback={
              <box paddingLeft={1}>
                <text fg={theme.textMuted}>No sessions</text>
              </box>
            }
          >
            <scrollbox flexGrow={1} scrollAcceleration={scrollAcceleration()}>
              <For each={grouped()}>
                {(group) => (
                  <>
                    <box paddingLeft={1} paddingTop={1} paddingBottom={1}>
                      <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                        {group.category}
                      </text>
                    </box>
                    <For each={group.items}>
                      {(item) => {
                        const active = () => item.value === selectedSession()?.value
                        return (
                          <box
                            flexDirection="row"
                            onMouseUp={() => {
                              const idx = flat().findIndex((x) => x.value === item.value)
                              if (idx >= 0) setSelected(idx)
                              select()
                            }}
                            onMouseOver={() => {
                              const idx = flat().findIndex((x) => x.value === item.value)
                              if (idx >= 0) setSelected(idx)
                            }}
                            backgroundColor={active() ? theme.primary : undefined}
                            paddingLeft={1}
                            paddingRight={1}
                          >
                            <text
                              fg={active() ? selectedForeground(theme) : theme.text}
                              attributes={active() ? TextAttributes.BOLD : undefined}
                              overflow="hidden"
                              wrapMode="none"
                            >
                              {Locale.truncate(item.title, 28)}
                            </text>
                          </box>
                        )
                      }}
                    </For>
                  </>
                )}
              </For>
            </scrollbox>
          </Show>
          <box paddingLeft={1} paddingTop={1}>
            <text fg={theme.textMuted}>
              {flat().length} session{flat().length !== 1 ? "s" : ""}
            </text>
          </box>
        </box>
      </box>
    </Show>
  )
}
