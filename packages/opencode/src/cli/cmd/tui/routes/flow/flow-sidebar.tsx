import { createMemo, createSignal, For, Show, onMount } from "solid-js"
import { useTheme } from "../../context/theme"
import { MOCK_PRDS, GITHUB_CONFIG, buildCreateBranchPrompt, loadPRDContent } from "./config"
import type { PRDEntry, GitHubRepo, PRDContent } from "./config"
import { Workflow } from "./workflow"
import { Log } from "@/util"

const log = Log.create({ service: "tui.flow.sidebar" })

export function FlowSidebar(props: {
  overlay?: boolean
  selectedPRD?: string
  selectedPRDContent?: PRDContent
  checkedFiles?: Set<string>
  onCheckPRD?: (prdID: string | undefined, content?: PRDContent) => void
  onCheckFile?: (prdID: string, fileKey: "f" | "b", checked: boolean) => void
  selectedRepo?: string
  prdTitle?: string
  repoPath?: string
  onSelectedRepoChange?: (repo: string | undefined) => void
  onCreateBranch?: (prompt: string) => void
}) {
  const { theme } = useTheme()
  const [repos, setRepos] = createSignal<GitHubRepo[]>([])
  const [reposLoading, setReposLoading] = createSignal(false)
  const [reposError, setReposError] = createSignal<string | undefined>()
  const [prdExpanded, setPrdExpanded] = createSignal(true)
  const [repoExpanded, setRepoExpanded] = createSignal(true)
  const [workflowExpanded, setWorkflowExpanded] = createSignal(true)

  onMount(() => {
    fetchGitHubRepos()
  })

  async function fetchGitHubRepos() {
    setReposLoading(true)
    setReposError(undefined)
    try {
      const url = `${GITHUB_CONFIG.baseUrl}${GITHUB_CONFIG.apiPath}?${GITHUB_CONFIG.params}`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${GITHUB_CONFIG.token}` },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as GitHubRepo[]
      setRepos(data)
      log.info("fetched github repos", { count: data.length })
    } catch (err) {
      const msg = String(err)
      setReposError(msg)
      log.error("failed to fetch github repos", { error: msg })
    } finally {
      setReposLoading(false)
    }
  }

  const prdList = createMemo(() => MOCK_PRDS)

  const canCreateBranch = createMemo(() => props.selectedPRD && props.selectedRepo)

  function handleCreateBranch() {
    const repo = props.selectedRepo
    if (!repo) return
    const prdTitle = props.selectedPRD
      ? prdList().find((p) => p.id === props.selectedPRD)?.title
      : undefined
    const prompt = buildCreateBranchPrompt(repo, prdTitle)
    log.info("create branch prompt generated", { repo, prdTitle })
    props.onCreateBranch?.(prompt)
  }

  const isFileChecked = (prdID: string, fileKey: "f" | "b") =>
    props.selectedPRD === prdID && props.checkedFiles?.has(fileKey)

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
        <text fg={theme.text}>
          <b>Flow</b>
        </text>
      </box>
      <box flexShrink={0} height={1} backgroundColor={theme.border} />

      <box flexDirection="column" flexGrow={1}>
          <box
            flexDirection="row"
            gap={1}
            paddingTop={1}
            onMouseUp={() => setPrdExpanded((x) => !x)}
          >
            <text fg={theme.text}>{prdExpanded() ? "▼" : "▶"}</text>
            <text fg={theme.text}>
              <b>PRD</b>
            </text>
            <text fg={theme.textMuted}>({prdList().length})</text>
          </box>

          <Show when={prdExpanded()}>
            <For each={prdList()}>
              {(prd: PRDEntry) => (
                <box paddingLeft={2} paddingX={1} paddingY={0} flexDirection="row" gap={1} marginBottom={1}>
                  <text
                    fg={props.selectedPRD === prd.id ? theme.text : theme.textMuted}
                    onMouseUp={async (evt: any) => {
                      evt.stopPropagation()
                      if (props.selectedPRD === prd.id) {
                        log.info("prd uncheck", { id: prd.id })
                        props.onCheckPRD?.(undefined, undefined)
                      } else {
                        const content = await loadPRDContent(prd.id) as PRDContent | undefined
                        log.info("prd check", { id: prd.id, hasContent: !!content })
                        props.onCheckPRD?.(prd.id, content)
                      }
                    }}
                  >
                    {prd.name}: {prd.title}
                  </text>
                  <text
                    fg={isFileChecked(prd.id, "f") ? theme.success : theme.textMuted}
                    onMouseUp={(evt: any) => {
                      evt.stopPropagation()
                      const checked = isFileChecked(prd.id, "f")
                      if (!checked && props.selectedPRD !== prd.id) {
                        loadPRDContent(prd.id).then((content) => {
                          props.onCheckPRD?.(prd.id, content as PRDContent | undefined)
                          props.onCheckFile?.(prd.id, "f", true)
                        })
                      } else {
                        props.onCheckFile?.(prd.id, "f", !checked)
                      }
                    }}
                  >
                    [{isFileChecked(prd.id, "f") ? "x" : " "}]f
                  </text>
                  <text
                    fg={isFileChecked(prd.id, "b") ? theme.success : theme.textMuted}
                    onMouseUp={(evt: any) => {
                      evt.stopPropagation()
                      const checked = isFileChecked(prd.id, "b")
                      if (!checked && props.selectedPRD !== prd.id) {
                        loadPRDContent(prd.id).then((content) => {
                          props.onCheckPRD?.(prd.id, content as PRDContent | undefined)
                          props.onCheckFile?.(prd.id, "b", true)
                        })
                      } else {
                        props.onCheckFile?.(prd.id, "b", !checked)
                      }
                    }}
                  >
                    [{isFileChecked(prd.id, "b") ? "x" : " "}]b
                  </text>
                </box>
              )}
            </For>
          </Show>

          <box
            flexDirection="row"
            gap={1}
            paddingTop={1}
            onMouseUp={() => setRepoExpanded((x) => !x)}
          >
            <text fg={theme.text}>{repoExpanded() ? "▼" : "▶"}</text>
            <text fg={theme.text}>
              <b>GitHub</b>
            </text>
            <text fg={theme.textMuted}>({repos().length})</text>
          </box>

          <Show when={repoExpanded()}>
            <box flexDirection="column">
              <Show when={reposLoading()}>
                <box paddingLeft={2}>
                  <text fg={theme.textMuted}>loading...</text>
                </box>
              </Show>

              <Show when={reposError()}>
                <box paddingLeft={2}>
                  <text fg={theme.error}>{reposError()}</text>
                </box>
              </Show>

              <For each={repos()}>
                {(repo: GitHubRepo) => (
                  <box
                    paddingLeft={2}
                    paddingX={1}
                    paddingY={0}
                    flexDirection="row"
                    gap={1}
                    onMouseUp={() =>
                      props.onSelectedRepoChange?.(
                        props.selectedRepo === repo.full_name ? undefined : repo.full_name,
                      )
                    }
                  >
                    <text fg={theme.text}>
                      {props.selectedRepo === repo.full_name ? "●" : "○"}
                    </text>
                    <text fg={theme.text} wrapMode="none">
                      {repo.full_name}
                    </text>
                  </box>
                )}
              </For>
            </box>
          </Show>

          <Show when={canCreateBranch()}>
            <box paddingTop={1} paddingLeft={1}>
              <box
                backgroundColor={theme.backgroundElement}
                paddingX={1}
                paddingY={0}
                onMouseUp={handleCreateBranch}
              >
                <text fg={theme.success}>+ 创建分支 & 拉取代码</text>
              </box>
            </box>
          </Show>

          <box
            flexDirection="row"
            gap={1}
            paddingTop={1}
            onMouseUp={() => setWorkflowExpanded((x) => !x)}
          >
            <text fg={theme.text}>{workflowExpanded() ? "▼" : "▶"}</text>
            <text fg={theme.text}>
              <b>Workflow</b>
            </text>
          </box>

          <Show when={workflowExpanded()}>
            <Workflow prdTitle={props.prdTitle} prdJsonContent={props.selectedPRDContent} prdID={props.selectedPRD} checkedFiles={props.checkedFiles} repoPath={props.repoPath} />
          </Show>
        </box>

      <box flexShrink={0}>
        <box height={1} backgroundColor={theme.border} marginBottom={1} />
        <text fg={theme.textMuted}>PRD: {props.selectedPRD ? props.selectedPRDContent ? (() => { const c = []; if (isFileChecked(props.selectedPRD!, "f")) c.push("f.json"); if (isFileChecked(props.selectedPRD!, "b")) c.push("b.json"); return c.length > 0 ? `✓ (${c.join(" + ")})` : "✓"; })() : "✓" : "—"}</text>
        <text fg={theme.textMuted}>Repo: {props.selectedRepo ? "✓" : "—"}</text>
      </box>
    </box>
  )
}
