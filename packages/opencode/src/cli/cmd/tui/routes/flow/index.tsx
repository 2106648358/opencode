import { batch, createEffect, createMemo, createSignal, Match, Show, Switch } from "solid-js"
import { useRouteData } from "@tui/context/route"
import { useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { useSDK } from "@tui/context/sdk"
import { useProject } from "@tui/context/project"
import { usePromptRef } from "@tui/context/prompt"
import { useKV } from "@tui/context/kv"
import { useKeybind } from "@tui/context/keybind"
import { useTheme } from "@tui/context/theme"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { Prompt, type PromptRef } from "@tui/component/prompt"
import { TuiPluginRuntime } from "../../plugin"
import { Toast } from "../../ui/toast"
import { useToast } from "../../ui/toast"
import { useCommandDialog } from "../../component/dialog-command"
import { RGBA } from "@opentui/core"
import { FlowSidebar } from "./flow-sidebar"
import { Workflow } from "./workflow"
import { errorMessage } from "@/util/error"

export function Flow() {
  const route = useRouteData("flow")
  const { navigate } = useRoute()
  const sync = useSync()
  const project = useProject()
  const sdk = useSDK()
  const promptRef = usePromptRef()
  const kv = useKV()
  const keybind = useKeybind()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const toast = useToast()
  const command = useCommandDialog()

  const session = createMemo(() => sync.session.get(route.sessionID))

  const [sidebar, setSidebar] = kv.signal<"auto" | "hide">("sidebar", "auto")
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const wide = createMemo(() => dimensions().width > 120)
  const sidebarVisible = createMemo(() => {
    if (sidebarOpen()) return true
    if (sidebar() === "auto" && wide()) return true
    return false
  })

  useKeyboard((evt) => {
    if (keybind.match("sidebar_toggle", evt)) {
      batch(() => {
        const isVisible = sidebarVisible()
        setSidebar(() => (isVisible ? "hide" : "auto"))
        setSidebarOpen(!isVisible)
      })
      evt.preventDefault()
    }
  })

  let prompt: PromptRef | undefined
  const bind = (r: PromptRef | undefined) => {
    prompt = r
    promptRef.set(r)
  }

  createEffect(() => {
    const sessionID = route.sessionID
    void (async () => {
      const previousWorkspace = project.workspace.current()
      const result = await sdk.client.session.get({ sessionID }, { throwOnError: true })
      if (!result.data) {
        toast.show({
          message: `Session not found: ${sessionID}`,
          variant: "error",
          duration: 5000,
        })
        navigate({ type: "home" })
        return
      }

      if (result.data.workspaceID !== previousWorkspace) {
        project.workspace.set(result.data.workspaceID)
        try {
          await sync.bootstrap({ fatal: false })
        } catch {}
      }
      await sync.session.sync(sessionID)
    })().catch((error) => {
      if (route.sessionID !== sessionID) return
      toast.show({
        message: errorMessage(error),
        variant: "error",
        duration: 5000,
      })
    })
  })

  command.register(() => [
    {
      title: "Switch to Chat",
      value: "flow.chat",
      suggested: true,
      category: "Flow",
      slash: {
        name: "chat",
      },
      onSelect: () => {
        navigate({ type: "session", sessionID: route.sessionID })
      },
    },
    {
      title: "New session",
      value: "flow.new",
      keybind: "session_new",
      category: "Flow",
      slash: {
        name: "new",
        aliases: ["clear"],
      },
      onSelect: () => {
        navigate({ type: "home" })
      },
    },
  ])

  return (
    <>
      <box flexDirection="row" flexGrow={1}>
        <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
          <Show when={session()}>
            <box flexDirection="row" paddingTop={1} paddingBottom={1} justifyContent="space-between">
              <text fg={theme.text}>
                <b>Flow Mode</b>
              </text>
              <box
                onMouseUp={() => navigate({ type: "session", sessionID: route.sessionID })}
                paddingX={1}
              >
                <text fg={theme.accent}>[Switch to Chat]</text>
              </box>
            </box>
            <box height={1} backgroundColor={theme.border} />

            <scrollbox flexGrow={1}>
              <Workflow />
            </scrollbox>

            <box flexShrink={0} paddingBottom={1}>
              <TuiPluginRuntime.Slot
                name="session_prompt"
                mode="replace"
                session_id={route.sessionID}
                ref={bind}
              >
                <Prompt
                  ref={bind}
                  sessionID={route.sessionID}
                  right={
                    <TuiPluginRuntime.Slot name="session_prompt_right" session_id={route.sessionID} />
                  }
                />
              </TuiPluginRuntime.Slot>
            </box>
          </Show>
          <Toast />
        </box>

        <Show when={sidebarVisible()}>
          <Switch>
            <Match when={wide()}>
              <FlowSidebar />
            </Match>
            <Match when={!wide()}>
              <box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                alignItems="flex-end"
                backgroundColor={RGBA.fromInts(0, 0, 0, 70)}
              >
                <FlowSidebar overlay />
              </box>
            </Match>
          </Switch>
        </Show>
      </box>
    </>
  )
}
