import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createRoot, createSignal, For, Show, createMemo } from "solid-js"
import { Template, TemplateRegistry, type ParsedTemplate } from "@/template"
import { TuiEvent } from "../../event"
import { Bus } from "@/bus"
import { ConfigTemplate } from "@/config/template"
import { DialogTemplateFill } from "../../component/dialog-template-fill"
import path from "path"
import fs from "fs/promises"

const id = "internal:sidebar-templates"

const [templates, setTemplates] = createRoot(() => createSignal<ParsedTemplate[]>([]))

async function readTemplateConfig(directory: string): Promise<ConfigTemplate.Info> {
  for (const file of ["opencode.jsonc", "opencode.json", "config.json"]) {
    try {
      const text = await fs.readFile(path.join(directory, file), "utf-8")
      const data = JSON.parse(text)
      if (data.template) return data.template as ConfigTemplate.Info
    } catch {}
  }
  return {}
}

function handleSelect(t: ParsedTemplate, api: TuiPluginApi) {
  if (t.variables.length === 0) {
    Bus.publish(TuiEvent.PromptAppend, { text: t.body })
    return
  }

  api.ui.dialog.replace(() => (
    <api.ui.Dialog onClose={() => api.ui.dialog.clear()}>
      <DialogTemplateFill template={t} />
    </api.ui.Dialog>
  ))
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const list = () => templates()
  const show = createMemo(() => list().length > 0)

  return (
    <Show when={show()}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => list().length > 2 && setOpen((x) => !x)}>
          <Show when={list().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>Templates</b>
          </text>
        </box>
        <Show when={list().length <= 2 || open()}>
          <For each={list()}>
            {(t) => (
              <text
                fg={theme().text}
                onMouseUp={() => handleSelect(t, props.api)}
              >
                {t.name}
              </text>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  const dir = api.state.path.directory
  const templateConfig = await readTemplateConfig(dir)
  const registry = new TemplateRegistry()
  await registry.init(templateConfig)
  setTemplates(registry.list())

  registry.onUpdate((list) => setTemplates(list))

  api.command.register(() =>
    templates().map((t) => ({
      title: t.name,
      value: `template:${t.key}`,
      description: t.description,
      category: "Templates",
      slash: { name: t.key },
      onSelect: () => handleSelect(t, api),
    })),
  )

  api.slots.register({
    order: 350,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
