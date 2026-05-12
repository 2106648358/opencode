import { createMemo, For, Show } from "solid-js"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { useTerminalDimensions } from "@opentui/solid"
import { Locale } from "@/util"

export function DialogAIStats(props: { onClose: () => void }) {
  const sync = useSync()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()

  const contrib = createMemo(() => sync.data.contrib as {
    sessions: number
    added: number
    deleted: number
    files: number
    totalLines: number
    aiContributedLines: number
    byModel: { model: string; sessions: number; added: number; deleted: number }[]
    topFiles: { file: string; added: number; deleted: number; totalLines: number; aiLines: number; ratio: number }[]
    recentSessions: { id: string; title: string; time: number; model: string; added: number; deleted: number }[]
  } | null)

  const maxModelAdded = createMemo(() => {
    const c = contrib()
    return c && c.byModel.length > 0 ? Math.max(...c.byModel.map((m) => m.added)) : 1
  })

  const maxFileTotal = createMemo(() => {
    const c = contrib()
    return c && c.topFiles.length > 0 ? Math.max(...c.topFiles.map((f) => f.added + f.deleted)) : 1
  })

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={theme.backgroundPanel}
      zIndex={4000}
      onMouseUp={() => props.onClose()}
    >
      <box flexDirection="column" width="100%" height="100%">
        <box flexShrink={0} paddingLeft={2} paddingRight={2} paddingY={1} backgroundColor={theme.backgroundElement}>
          <text fg={theme.accent}>AI 贡献报告</text>
          <text fg={theme.textMuted}> </text>
          <text fg={theme.textMuted}>Esc 或点击任意处关闭</text>
        </box>

        <Show when={!contrib() || contrib()!.sessions === 0}>
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <text fg={theme.textMuted}>暂无贡献数据。</text>
          </box>
        </Show>

        <Show when={contrib() && contrib()!.sessions > 0}>
          <scrollbox flexGrow={1}>
            <box flexDirection="column" paddingX={2} paddingY={1}>
              <text fg={theme.accent}>总览</text>
              <box flexDirection="row" gap={1} paddingTop={1}>
                <box flexGrow={1} flexDirection="column" alignItems="center">
                  <text fg={theme.textMuted}>会话数</text>
                  <text fg={theme.text}>{contrib()!.sessions}</text>
                </box>
                <box flexGrow={1} flexDirection="column" alignItems="center">
                  <text fg={theme.textMuted}>新增</text>
                  <text fg={theme.success}>+{contrib()!.added.toLocaleString()}</text>
                </box>
                <box flexGrow={1} flexDirection="column" alignItems="center">
                  <text fg={theme.textMuted}>删除</text>
                  <text fg={theme.error}>{contrib()!.deleted.toLocaleString()}</text>
                </box>
                <box flexGrow={1} flexDirection="column" alignItems="center">
                  <text fg={theme.textMuted}>文件数</text>
                  <text fg={theme.text}>{contrib()!.files}</text>
                </box>
                <box flexGrow={1} flexDirection="column" alignItems="center">
                  <text fg={theme.textMuted}>净增</text>
                  <text fg={contrib()!.added - contrib()!.deleted >= 0 ? theme.success : theme.error}>
                    {contrib()!.added - contrib()!.deleted >= 0 ? "+" : ""}{(contrib()!.added - contrib()!.deleted).toLocaleString()}
                  </text>
                </box>
              </box>

              <Show when={contrib()!.totalLines > 0}>
                <box height={1} backgroundColor={theme.border} marginTop={1} marginBottom={1} />
                <text fg={theme.accent}>AI 贡献</text>
                <box flexDirection="row" gap={1} paddingTop={1}>
                  <box flexGrow={1} flexDirection="column" alignItems="center">
                    <text fg={theme.textMuted}>仓库行数</text>
                    <text fg={theme.text}>{contrib()!.totalLines.toLocaleString()}</text>
                  </box>
                  <box flexGrow={1} flexDirection="column" alignItems="center">
                    <text fg={theme.textMuted}>AI 行数</text>
                    <text fg={theme.success}>{contrib()!.aiContributedLines.toLocaleString()}</text>
                  </box>
                  <box flexGrow={1} flexDirection="column" alignItems="center">
                    <text fg={theme.textMuted}>AI 占比</text>
                    <text fg={theme.text}>
                      {contrib()!.totalLines > 0
                        ? ((contrib()!.aiContributedLines / contrib()!.totalLines) * 100).toFixed(1) + "%"
                        : "-"}
                    </text>
                  </box>
                </box>
              </Show>

              <Show when={contrib()!.byModel.length > 0}>
                <box height={1} backgroundColor={theme.border} marginTop={1} marginBottom={1} />
                <text fg={theme.accent}>按模型</text>
                <For each={contrib()!.byModel}>
                  {(m) => {
                    const barLen = Math.max(1, Math.round((m.added / maxModelAdded()) * 30))
                    const bar = "█".repeat(barLen)
                    return (
                      <box flexDirection="row" paddingTop={0} gap={1}>
                        <box width={24} overflow="hidden">
                          <text fg={theme.text} wrapMode="none">{m.model}</text>
                        </box>
                        <text fg={theme.success}>+{m.added.toLocaleString()}</text>
                        <text fg={theme.textMuted}>/</text>
                        <text fg={theme.error}>-{m.deleted.toLocaleString()}</text>
                        <text fg={theme.textMuted}>{" "}{m.sessions}s</text>
                        <text fg={theme.textMuted}>{bar}</text>
                      </box>
                    )
                  }}
                </For>
              </Show>

              <Show when={contrib()!.topFiles.length > 0}>
                <box height={1} backgroundColor={theme.border} marginTop={1} marginBottom={1} />
                <text fg={theme.accent}>热门文件</text>
                <For each={contrib()!.topFiles}>
                  {(f) => {
                    const total = f.added + f.deleted
                    const barLen = Math.max(1, Math.round((total / maxFileTotal()) * 30))
                    const bar = "█".repeat(barLen)
                    const filePath = f.file.length > 28 ? "..." + f.file.slice(-25) : f.file
                    const ratio = (f.ratio * 100).toFixed(1) + "%"
                    return (
                      <box flexDirection="row" paddingTop={0} gap={1}>
                        <box width={28} overflow="hidden">
                          <text fg={theme.text} wrapMode="none">{filePath}</text>
                        </box>
                        <text fg={theme.success}>+{f.added}</text>
                        <text fg={theme.textMuted}>/</text>
                        <text fg={theme.error}>-{f.deleted}</text>
                        <text fg={theme.textMuted}>{" "}{ratio}</text>
                        <text fg={theme.textMuted}>{bar}</text>
                      </box>
                    )
                  }}
                </For>
              </Show>

              <Show when={contrib()!.recentSessions.length > 0}>
                <box height={1} backgroundColor={theme.border} marginTop={1} marginBottom={1} />
                <text fg={theme.accent}>最近会话</text>
                <For each={contrib()!.recentSessions.slice(-10).reverse()}>
                  {(s) => (
                    <box flexDirection="row" paddingTop={0} gap={1}>
                      <box width={14} flexShrink={0}>
                        <text fg={theme.textMuted}>{Locale.todayTimeOrDateTime(s.time)}</text>
                      </box>
                      <box width={22} overflow="hidden">
                        <text fg={theme.text} wrapMode="none">{s.title}</text>
                      </box>
                      <text fg={theme.success}>+{s.added}</text>
                      <text fg={theme.textMuted}>/</text>
                      <text fg={theme.error}>-{s.deleted}</text>
                      <text fg={theme.textMuted}>{" "}{s.model}</text>
                    </box>
                  )}
                </For>
              </Show>
            </box>
          </scrollbox>
        </Show>
      </box>
    </box>
  )
}