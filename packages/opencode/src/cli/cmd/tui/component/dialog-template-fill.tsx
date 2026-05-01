import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "@tui/ui/dialog"
import { createSignal, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { ParsedTemplate } from "@/template"
import { TemplateVariables } from "@/template"
import { TuiEvent } from "../event"
import { Bus } from "@/bus"

export type DialogTemplateFillProps = {
  template: ParsedTemplate
  onConfirm?: (text: string) => void
  onCancel?: () => void
}

export function DialogTemplateFill(props: DialogTemplateFillProps) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const [values, setValues] = createSignal<Record<string, string>>({})
  const [error, setError] = createSignal("")
  const variables = () => props.template.variables

  useKeyboard((evt) => {
    if (evt.name === "return") {
      confirm()
    }
  })

  function set(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
    setError("")
  }

  function confirm() {
    const missing = TemplateVariables.validateRequired(variables(), values())
    if (missing.length > 0) {
      setError(`Missing: ${missing.join(", ")}`)
      return
    }
    const text = TemplateVariables.substitute(props.template.body, values())
    Bus.publish(TuiEvent.PromptAppend, { text })
    props.onConfirm?.(text)
    dialog.clear()
  }

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {props.template.name}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <text fg={theme.textMuted}>{props.template.description}</text>
      <For each={variables()}>
        {(v) => (
          <box flexDirection="row" gap={1}>
            <text fg={theme.text} width={12}>{v.name}:</text>
            <input
              placeholder={v.description ?? ""}
              placeholderColor={theme.textMuted}
              value={values()[v.name] ?? ""}
              onInput={(val) => set(v.name, val)}
              focusedBackgroundColor={theme.background}
              focusedTextColor={theme.text}
            />
          </box>
        )}
      </For>
      <Show when={error()}>
        <text fg={theme.error}>{error()}</text>
      </Show>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1} gap={1}>
        <text fg={theme.textMuted} onMouseUp={() => { props.onCancel?.(); dialog.clear() }}>
          Cancel
        </text>
        <text fg={theme.success} onMouseUp={confirm}>
          Confirm
        </text>
      </box>
    </box>
  )
}
