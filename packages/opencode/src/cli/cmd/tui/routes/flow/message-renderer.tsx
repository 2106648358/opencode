import { createMemo, For, Show } from "solid-js"
import { useTheme } from "../../context/theme"
import { useLocal } from "@tui/context/local"
import { useSync } from "@tui/context/sync"
import type { AssistantMessage, UserMessage } from "@opencode-ai/sdk/v2"

export function FlowMessages(props: {
  messages: (UserMessage | AssistantMessage)[]
  flowMsgIds: Set<string>
}) {
  const { theme } = useTheme()

  return (
    <For each={props.messages}>
      {(message) => {
        const isFlow = createMemo(() => props.flowMsgIds.has(message.id))
        const badge = createMemo(() => (isFlow() ? "[Flow]" : "[Chat]"))
        const badgeColor = createMemo(() => (isFlow() ? theme.accent : theme.textMuted))

        return (
          <Show when={message.role === "user" || message.role === "assistant"}>
            <box flexDirection="row" marginTop={1}>
              <box flexShrink={0} width={8} paddingRight={1}>
                <text fg={badgeColor()}>{badge()}</text>
              </box>
              <box flexGrow={1}>
                <Show when={message.role === "user"}>
                  <UserMessageSimple message={message as UserMessage} />
                </Show>
                <Show when={message.role === "assistant"}>
                  <AssistantMessageSimple message={message as AssistantMessage} />
                </Show>
              </box>
            </box>
          </Show>
        )
      }}
    </For>
  )
}

function UserMessageSimple(props: { message: UserMessage }) {
  const sync = useSync()
  const { theme } = useTheme()
  const local = useLocal()
  const parts = createMemo(() => sync.data.part[props.message.id] ?? [])
  const text = createMemo(() => {
    return parts()
      .map((x) => (x.type === "text" ? x.text : null))
      .filter(Boolean)
      .join("\n\n")
  })
  const color = createMemo(() => local.agent.color(props.message.agent))

  return (
    <Show when={text().trim()}>
      <box border={["left"]} borderColor={color()} paddingLeft={2}>
        <text fg={theme.text}>{text()}</text>
      </box>
    </Show>
  )
}

function AssistantMessageSimple(props: { message: AssistantMessage }) {
  const sync = useSync()
  const { theme } = useTheme()
  const parts = createMemo(() => sync.data.part[props.message.id] ?? [])
  const textParts = createMemo(() => parts().filter((x) => x.type === "text"))

  return (
    <For each={textParts()}>
      {(part) => (
        <Show when={part.text.trim()}>
          <box paddingLeft={2}>
            <text fg={theme.text}>{part.text.trim()}</text>
          </box>
        </Show>
      )}
    </For>
  )
}
