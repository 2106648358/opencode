import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, For, Show, onMount } from "solid-js"
import { usePromptRef } from "../../context/prompt"
import { useDialog } from "../../ui/dialog"
import * as Repo from "@/template/repo"
import * as TemplateFile from "@/template/file"
import * as TemplateAuth from "@/template/auth"
import * as TemplateGit from "@/template/git"
import { DialogPrompt } from "../../ui/dialog-prompt"
import { DialogConfirm } from "../../ui/dialog-confirm"
import { Log } from "@/util"

const log = Log.create({ service: "tui.plugin.prompt-templates" })

const id = "internal:sidebar-prompt-templates"

type UiRepo = Repo.RepoEntry & { loading?: boolean; error?: string }

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [repos, setRepos] = createSignal<UiRepo[]>([])
  const [localTemplates, setLocalTemplates] = createSignal<TemplateFile.TemplateEntry[]>([])
  const [repoTemplates, setRepoTemplates] = createSignal<Record<string, TemplateFile.TemplateEntry[]>>({})
  const [expanded, setExpanded] = createSignal(true)
  const [localExpanded, setLocalExpanded] = createSignal(true)
  const [repoExpanded, setRepoExpanded] = createSignal<Record<string, boolean>>({})
  const theme = () => props.api.theme.current
  const promptRef = usePromptRef()
  const dialog = useDialog()

  onMount(async () => {
    log.info("mounting prompt templates plugin")

    try {
      await Repo.ensureTemplateDir()

      const localDir = await getLocalDir()
      const local = await TemplateFile.listTemplates(localDir)
      setLocalTemplates(local)
      log.info("loaded local templates", { count: local.length })
    } catch (err) {
      log.error("failed to load local templates", { error: String(err) })
    }

    try {
      const loaded = await Repo.loadRepos()
      setRepos(loaded.map((r) => ({ ...r })))
      log.info("loaded repos", { count: loaded.length })

      for (const repo of loaded) {
        const dir = Repo.repoDir(repo)
        const stats = await statDir(dir)
        if (stats?.isDirectory()) {
          const list = await TemplateFile.listTemplates(dir)
          setRepoTemplates((prev) => ({ ...prev, [repo.name]: list }))
          log.info("loaded repo templates", { repo: repo.name, count: list.length })
        }
      }
    } catch (err) {
      log.error("failed to load repos", { error: String(err) })
    }
  })

  async function handleInject(entry: TemplateFile.TemplateEntry) {
    try {
      log.info("injecting template", { name: entry.name, repo: entry.repo })
      const ref = promptRef.current
      if (ref) {
        ref.set({ input: entry.content, parts: [] })
        ref.focus()
      } else {
        log.warn("prompt ref not available, trying Bus.publish")
        const { TuiEvent } = await import("../../event")
        const { Bus } = await import("@/bus")
        await Bus.publish(TuiEvent.PromptAppend, { text: entry.content })
      }
      props.api.ui.toast({ message: `已注入模板: ${entry.name}`, variant: "info" })
    } catch (err) {
      log.error("failed to inject template", { error: String(err) })
      props.api.ui.toast({ message: "注入失败", variant: "error" })
    }
  }

  async function handleAddLocal() {
    try {
      log.info("adding local template")
      const name = await DialogPrompt.show(dialog, "模板名称", {
        placeholder: "my-template",
      })
      if (!name) return

      const content = await DialogPrompt.show(dialog, "模板内容", {
        placeholder: "请输入模板内容...",
        multiLine: true,
      })
      if (content === null) return

      const localDir = await getLocalDir()
      await TemplateFile.createTemplate(localDir, name, content ?? "")
      setLocalTemplates(await TemplateFile.listTemplates(localDir))
      props.api.ui.toast({ message: `已创建模板: ${name}`, variant: "success" })
      log.info("created local template", { name })
    } catch (err) {
      log.error("failed to create template", { error: String(err) })
      props.api.ui.toast({ message: `创建失败: ${String(err)}`, variant: "error" })
    }
  }

  async function handleAddRepoTemplate(repo: UiRepo) {
    try {
      log.info("adding template in repo", { repo: repo.name })
      const name = await DialogPrompt.show(dialog, "模板名称", {
        placeholder: "my-template",
      })
      if (!name) return

      const content = await DialogPrompt.show(dialog, "模板内容", {
        placeholder: "请输入模板内容...",
        multiLine: true,
      })
      if (content === null) return

      await TemplateFile.createTemplate(Repo.repoDir(repo), name, content ?? "")
      const list = await TemplateFile.listTemplates(Repo.repoDir(repo))
      setRepoTemplates((prev) => ({ ...prev, [repo.name]: list }))
      props.api.ui.toast({ message: `已创建模板: ${name}`, variant: "success" })
    } catch (err) {
      log.error("failed to create repo template", { error: String(err) })
      props.api.ui.toast({ message: `创建失败: ${String(err)}`, variant: "error" })
    }
  }

  async function handleDelete(entry: TemplateFile.TemplateEntry) {
    try {
      log.info("deleting template", { name: entry.name, repo: entry.repo })
      const confirmed = await DialogConfirm.show(dialog, "删除模板", `确定删除 "${entry.name}" 吗？`)
      if (!confirmed) return

      await TemplateFile.deleteTemplate(entry.filePath)
      await refreshEntry(entry)
      props.api.ui.toast({ message: `已删除: ${entry.name}`, variant: "info" })
    } catch (err) {
      log.error("failed to delete template", { error: String(err) })
      props.api.ui.toast({ message: `删除失败: ${String(err)}`, variant: "error" })
    }
  }

  async function handleEdit(entry: TemplateFile.TemplateEntry) {
    try {
      log.info("editing template", { name: entry.name, repo: entry.repo })
      const content = await DialogPrompt.show(dialog, `编辑模板: ${entry.name}`, {
        placeholder: "请输入模板内容...",
        value: entry.content,
        multiLine: true,
      })
      if (content === null) return

      await TemplateFile.updateTemplate(entry.filePath, content)
      await refreshEntry(entry)
      props.api.ui.toast({ message: `已更新: ${entry.name}`, variant: "success" })
    } catch (err) {
      log.error("failed to edit template", { error: String(err) })
      props.api.ui.toast({ message: `编辑失败: ${String(err)}`, variant: "error" })
    }
  }

  async function refreshEntry(entry: TemplateFile.TemplateEntry) {
    if (entry.repo === "local") {
      setLocalTemplates(await TemplateFile.listTemplates(await getLocalDir()))
    } else {
      const repo = repos().find((r) => r.name === entry.repo)
      if (repo) {
        const list = await TemplateFile.listTemplates(Repo.repoDir(repo))
        setRepoTemplates((prev) => ({ ...prev, [entry.repo]: list }))
      }
    }
  }

  async function handleAddRepo() {
    try {
      log.info("adding remote repo")

      const url = await DialogPrompt.show(dialog, "仓库 URL", {
        placeholder: "https://github.com/team/templates.git",
      })
      if (!url) return

      const name = await DialogPrompt.show(dialog, "仓库名称", {
        placeholder: "my-templates",
      })
      if (!name) return

      const dir = Repo.repoDir({ name, url, added_at: Date.now() })
      let success = false

      try {
        setRepos((prev) => [...prev, { name, url, added_at: Date.now(), loading: true }])

        await TemplateGit.cloneRepo(url, dir)
        success = true
        props.api.ui.toast({ message: `已添加仓库: ${name}`, variant: "success" })
        log.info("repo cloned successfully", { name, url })
      } catch (err) {
        const errMsg = String(err)
        log.warn("clone failed, may need auth", { name, error: errMsg })

        if (TemplateGit.needsAuth(errMsg)) {
          const token = await DialogPrompt.show(dialog, "请输入 Token (GitHub/GitLab)", {
            placeholder: "ghp_xxxxxxxxxxxx",
          })
          if (token) {
            await TemplateAuth.setRepoToken(name, token)
            try {
              await TemplateGit.cloneRepo(url, dir, token)
              success = true
              props.api.ui.toast({ message: `已添加仓库: ${name}`, variant: "success" })
              log.info("repo cloned with token", { name })
            } catch (err2) {
              log.error("clone with token also failed", { error: String(err2) })
              props.api.ui.toast({ message: `克隆失败: ${String(err2)}`, variant: "error" })
            }
          }
        } else {
          props.api.ui.toast({ message: `克隆失败: ${errMsg}`, variant: "error" })
        }
      }

      if (success) {
        await Repo.addRepo(name, url)
        const loaded = await Repo.loadRepos()
        setRepos(loaded.map((r) => ({ ...r })))
        const list = await TemplateFile.listTemplates(dir)
        setRepoTemplates((prev) => ({ ...prev, [name]: list }))
        setRepoExpanded((prev) => ({ ...prev, [name]: true }))
      } else {
        setRepos((prev) => prev.filter((r) => r.name !== name))
      }
    } catch (err) {
      log.error("failed to add repo", { error: String(err) })
      props.api.ui.toast({ message: `添加仓库失败: ${String(err)}`, variant: "error" })
    }
  }

  async function handleRemoveRepo(repo: UiRepo) {
    try {
      log.info("removing repo", { name: repo.name })
      const confirmed = await DialogConfirm.show(
        dialog,
        "移除仓库",
        `移除 "${repo.name}"？\n（不会删除远程仓库，可重新添加）`,
      )
      if (!confirmed) return

      await Repo.removeRepo(repo.name)
      await Repo.removeRepoDir(repo)
      setRepos(repos().filter((r) => r.name !== repo.name))
      setRepoTemplates((prev) => {
        const next = { ...prev }
        delete next[repo.name]
        return next
      })
      props.api.ui.toast({ message: `已移除仓库: ${repo.name}`, variant: "info" })
    } catch (err) {
      log.error("failed to remove repo", { error: String(err) })
    }
  }

  const repoList = createMemo(() => repos())
  const local = createMemo(() => localTemplates())

  function handle(evt: any, fn: () => void) {
    evt.stopPropagation()
    Promise.resolve().then(() => fn()).catch((err) => {
      log.error("handler error", { error: String(err) })
    })
  }

  return (
    <box>
      <box
        flexDirection="row"
        gap={1}
        onMouseDown={(evt: any) => { evt.stopPropagation(); setExpanded((x) => !x) }}
      >
        <text fg={theme().text}>{expanded() ? "▼" : "▶"}</text>
        <text fg={theme().text}>
          <b>Prompt Templates</b>
        </text>
      </box>

      <Show when={expanded()}>
        <box paddingLeft={1}>
          <box
            flexDirection="row"
            gap={1}
            onMouseDown={(evt: any) => { evt.stopPropagation(); setLocalExpanded((x) => !x) }}
          >
            <text fg={theme().text}>{localExpanded() ? "▼" : "▶"}</text>
            <text fg={theme().text}>Local</text>
            <text fg={theme().textMuted}>({local().length})</text>
            <box flexGrow={1} />
            <box onMouseDown={(evt: any) => handle(evt, handleAddLocal)}>
              <text fg={theme().success}>+</text>
            </box>
          </box>

          <Show when={localExpanded()}>
            <For each={local()}>
              {(entry) => (
                <box flexDirection="row" gap={1} paddingLeft={1}>
                  <box onMouseDown={(evt: any) => handle(evt, () => handleInject(entry))}>
                    <text fg={theme().text}>{entry.name}</text>
                  </box>
                  <box flexGrow={1} />
                  <box onMouseDown={(evt: any) => handle(evt, () => handleEdit(entry))}>
                    <text fg={theme().info}>✏</text>
                  </box>
                  <box onMouseDown={(evt: any) => handle(evt, () => handleDelete(entry))}>
                    <text fg={theme().error}>-</text>
                  </box>
                </box>
              )}
            </For>
          </Show>
        </box>

        <For each={repoList()}>
          {(repo) => {
            const templates = createMemo(() => repoTemplates()[repo.name] ?? [])
            const isExpanded = createMemo(() => repoExpanded()[repo.name] ?? true)

            return (
              <box paddingLeft={1}>
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={(evt: any) => {
                    evt.stopPropagation()
                    setRepoExpanded((prev) => ({
                      ...prev,
                      [repo.name]: !(prev[repo.name] ?? true),
                    }))
                  }}
                >
                  <text fg={theme().text}>{isExpanded() ? "▼" : "▶"}</text>
                  <text fg={theme().text}>{repo.name}</text>
                  <text fg={theme().textMuted}>({templates().length})</text>
                  <box flexGrow={1} />
                  <box onMouseDown={(evt: any) => handle(evt, () => handleAddRepoTemplate(repo))}>
                    <text fg={theme().success}>+</text>
                  </box>
                  <box onMouseDown={(evt: any) => handle(evt, () => handleRemoveRepo(repo))}>
                    <text fg={theme().error}>✕</text>
                  </box>
                </box>

                <Show when={isExpanded()}>
                  <Show when={repo.loading}>
                    <box paddingLeft={2}>
                      <text fg={theme().textMuted}>cloning...</text>
                    </box>
                  </Show>

                  <For each={templates()}>
                    {(entry) => (
                      <box flexDirection="row" gap={1} paddingLeft={1}>
                        <box onMouseDown={(evt: any) => handle(evt, () => handleInject(entry))}>
                          <text fg={theme().text}>{entry.name}</text>
                        </box>
                        <box flexGrow={1} />
                        <box onMouseDown={(evt: any) => handle(evt, () => handleEdit(entry))}>
                          <text fg={theme().info}>✏</text>
                        </box>
                        <box onMouseDown={(evt: any) => handle(evt, () => handleDelete(entry))}>
                          <text fg={theme().error}>-</text>
                        </box>
                      </box>
                    )}
                  </For>

                </Show>
              </box>
            )
          }}
        </For>

        <box paddingLeft={1}>
          <box onMouseDown={(evt: any) => handle(evt, handleAddRepo)}>
            <text fg={theme().accent}>[+ Add Repository]</text>
          </box>
        </box>
      </Show>
    </box>
  )
}

async function getLocalDir(): Promise<string> {
  const path = await import("path")
  const { Global } = await import("@opencode-ai/core/global")
  return path.join(Global.Path.data, "templates", "local")
}

async function statDir(dir: string) {
  const { stat } = await import("fs/promises")
  try {
    return await stat(dir)
  } catch {
    return undefined
  }
}

const tui: TuiPlugin = async (api) => {
  log.info("registering prompt templates plugin")
  api.slots.register({
    order: 600,
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
