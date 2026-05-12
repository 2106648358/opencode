import { createMemo, createSignal, For, Show, onMount } from "solid-js"
import { useTheme } from "../../context/theme"
import { MOCK_PRDS, GITLAB_CONFIG } from "./config"
import type { PRDEntry, GitLabRepo } from "./config"
import { Log } from "@/util"

const log = Log.create({ service: "tui.flow.sidebar" })

export function FlowSidebar(props: { overlay?: boolean }) {
  const { theme } = useTheme()
  const [selectedPRD, setSelectedPRD] = createSignal<string | undefined>()
  const [selectedRepo, setSelectedRepo] = createSignal<string | undefined>()
  const [repos, setRepos] = createSignal<GitLabRepo[]>([])
  const [reposLoading, setReposLoading] = createSignal(false)
  const [reposError, setReposError] = createSignal<string | undefined>()
  const [prdExpanded, setPrdExpanded] = createSignal(true)
  const [repoExpanded, setRepoExpanded] = createSignal(true)

  onMount(() => {
    fetchGitLabRepos()
  })

  async function fetchGitLabRepos() {
    setReposLoading(true)
    setReposError(undefined)
    try {
      const url = `${GITLAB_CONFIG.baseUrl}${GITLAB_CONFIG.apiPath}?${GITLAB_CONFIG.params}`
      const response = await fetch(url, {
        headers: { "PRIVATE-TOKEN": GITLAB_CONFIG.token },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as GitLabRepo[]
      setRepos(data)
      log.info("fetched gitlab repos", { count: data.length })
    } catch (err) {
      const msg = String(err)
      setReposError(msg)
      log.error("failed to fetch gitlab repos", { error: msg })
    } finally {
      setReposLoading(false)
    }
  }

  const prdList = createMemo(() => MOCK_PRDS)

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

      <scrollbox flexGrow={1}>
        <box flexDirection="column">
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
                <box
                  paddingLeft={2}
                  paddingX={1}
                  paddingY={0}
                  flexDirection="row"
                  gap={1}
                  onMouseUp={() => setSelectedPRD((prev) => (prev === prd.id ? undefined : prd.id))}
                >
                  <text fg={selectedPRD() === prd.id ? theme.accent : theme.text}>
                    {selectedPRD() === prd.id ? "●" : "○"}
                  </text>
                  <text fg={selectedPRD() === prd.id ? theme.accent : theme.text}>
                    {prd.name}: {prd.title}
                  </text>
                </box>
              )}
            </For>
          </Show>

          <box height={1} backgroundColor={theme.border} marginTop={1} />

          <box
            flexDirection="row"
            gap={1}
            paddingTop={1}
            onMouseUp={() => setRepoExpanded((x) => !x)}
          >
            <text fg={theme.text}>{repoExpanded() ? "▼" : "▶"}</text>
            <text fg={theme.text}>
              <b>GitLab</b>
            </text>
            <text fg={theme.textMuted}>({repos().length})</text>
          </box>

          <Show when={repoExpanded()}>
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
              {(repo: GitLabRepo) => (
                <box
                  paddingLeft={2}
                  paddingX={1}
                  paddingY={0}
                  flexDirection="row"
                  gap={1}
                  onMouseUp={() =>
                    setSelectedRepo((prev) =>
                      prev === repo.path_with_namespace ? undefined : repo.path_with_namespace,
                    )
                  }
                >
                  <text
                    fg={selectedRepo() === repo.path_with_namespace ? theme.accent : theme.text}
                  >
                    {selectedRepo() === repo.path_with_namespace ? "●" : "○"}
                  </text>
                  <text
                    fg={selectedRepo() === repo.path_with_namespace ? theme.accent : theme.text}
                    wrapMode="none"
                  >
                    {repo.path_with_namespace}
                  </text>
                </box>
              )}
            </For>
          </Show>

          <box height={1} backgroundColor={theme.border} marginTop={1} />

          <Show when={selectedRepo()}>
            <box paddingTop={1} paddingLeft={1}>
              <box
                backgroundColor={theme.backgroundElement}
                paddingX={1}
                paddingY={0}
                onMouseUp={() => {
                  log.info("create branch and pull", { repo: selectedRepo() })
                }}
              >
                <text fg={theme.success}>+ 创建分支 & 拉取代码</text>
              </box>
            </box>
          </Show>
        </box>
      </scrollbox>

      <box flexShrink={0}>
        <box height={1} backgroundColor={theme.border} marginBottom={1} />
        <text fg={theme.textMuted}>PRD: {selectedPRD() ? "✓" : "—"}</text>
        <text fg={theme.textMuted}>Repo: {selectedRepo() ? "✓" : "—"}</text>
      </box>
    </box>
  )
}
