import { TextareaRenderable, TextAttributes, PasteEvent, decodePasteBytes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog, type DialogContext } from "./dialog"
import { Show, createEffect, onMount, type JSX } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { Spinner } from "../component/spinner"
import * as Clipboard from "../util/clipboard"

export type DialogPromptProps = {
  title: string
  description?: () => JSX.Element
  placeholder?: string
  value?: string
  multiLine?: boolean
  busy?: boolean
  busyText?: string
  onConfirm?: (value: string) => void
  onCancel?: () => void
}

export function DialogPrompt(props: DialogPromptProps) {
  const dialog = useDialog()
  const { theme } = useTheme()
  let textarea: TextareaRenderable

  useKeyboard((evt) => {
    if (props.busy) {
      if (evt.name === "escape") return
      evt.preventDefault()
      evt.stopPropagation()
      return
    }
    if (evt.name === "return") {
      evt.preventDefault()
      evt.stopPropagation()
      props.onConfirm?.(textarea.plainText)
      return
    }
    if ((evt.name === "v" && (evt.ctrl || evt.meta)) || (evt.name === "insert" && evt.shift)) {
      evt.preventDefault()
      evt.stopPropagation()
      Clipboard.read().then((content) => {
        if (content?.mime === "text/plain" && content.data && textarea && !textarea.isDestroyed) {
          textarea.insertText(content.data)
        }
      }).catch(() => {})
    }
  })

  onMount(() => {
    dialog.setSize("medium")
    setTimeout(() => {
      if (!textarea || textarea.isDestroyed) return
      if (props.busy) return
      textarea.focus()
    }, 1)
    textarea.gotoLineEnd()
  })

  createEffect(() => {
    if (!textarea || textarea.isDestroyed) return
    const traits = props.busy
      ? {
          suspend: true,
          status: "BUSY",
        }
      : {}
    textarea.traits = traits
    if (props.busy) {
      textarea.blur()
      return
    }
    textarea.focus()
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {props.title}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <box gap={1}>
        {props.description}
        <textarea
          onSubmit={() => {
            if (props.busy) return
            props.onConfirm?.(textarea.plainText)
          }}
          height={props.multiLine ? 10 : 3}
          keyBindings={props.busy ? [] : []}
          ref={(val: TextareaRenderable) => {
            textarea = val
          }}
          initialValue={props.value}
          placeholder={props.placeholder ?? "Enter text"}
          placeholderColor={theme.textMuted}
          textColor={props.busy ? theme.textMuted : theme.text}
          focusedTextColor={props.busy ? theme.textMuted : theme.text}
          cursorColor={props.busy ? theme.backgroundElement : theme.text}
          onPaste={(event: PasteEvent) => {
            const text = decodePasteBytes(event.bytes).replace(/\r\n/g, "\n").replace(/\r/g, "\n")
            if (!text.trim()) return
            event.preventDefault()
            textarea.insertText(text)
          }}
        />
        <Show when={props.busy}>
          <Spinner color={theme.textMuted}>{props.busyText ?? "Working..."}</Spinner>
        </Show>
      </box>
      <box paddingBottom={1} gap={1} flexDirection="row">
        <Show when={!props.busy} fallback={<text fg={theme.textMuted}>processing...</text>}>
          <text fg={theme.text}>
            enter <span style={{ fg: theme.textMuted }}>submit</span>
            <Show when={props.multiLine}>
              {" "}<span style={{ fg: theme.textMuted }}>· ctrl+j newline</span>
            </Show>
          </text>
        </Show>
      </box>
    </box>
  )
}

DialogPrompt.show = (dialog: DialogContext, title: string, options?: Omit<DialogPromptProps, "title">) => {
  return new Promise<string | null>((resolve) => {
    dialog.replace(
      () => (
        <DialogPrompt
          title={title}
          {...options}
          onConfirm={(value) => {
            resolve(value)
            dialog.clear()
          }}
          onCancel={() => resolve(null)}
        />
      ),
      () => resolve(null),
    )
  })
}
