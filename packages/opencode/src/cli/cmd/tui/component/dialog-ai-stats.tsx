import { createMemo, For, Show } from "solid-js"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { useTerminalDimensions, useKeyboard } from "@opentui/solid"
import { Locale } from "@/util"
import type { RGBA } from "@opentui/core"

/** AI 贡献统计数据结构，与服务端 ContribStats 类型对应 */
type ContribData = {
  sessions: number
  added: number
  deleted: number
  /** AI 触及的文件条目总数（跨会话累加，非去重） */
  files: number
  /** 仓库文件总数 */
  totalFiles: number
  /** AI 触及的独立文件数（去重） */
  aiTouchedFiles: number
  totalLines: number
  aiContributedLines: number
  byModel: { model: string; sessions: number; added: number; deleted: number }[]
  topFiles: { file: string; added: number; deleted: number; totalLines: number; aiLines: number; ratio: number }[]
  recentSessions: { id: string; title: string; time: number; model: string; added: number; deleted: number }[]
}

/** 大数字缩略显示：>=1000 时显示为 1.2k 格式 */
function human(num: number) {
  if (num < 1000) return String(num)
  return (num / 1000).toFixed(1) + "k"
}

export function DialogAIStats(props: { onClose: () => void }) {
  const sync = useSync()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      props.onClose()
      evt.preventDefault()
      evt.stopPropagation()
    }
  })

  const contrib = createMemo(() => sync.data.contrib as ContribData | null)

  // ── 派生指标 ────────────────────────────────────────────

  /** 按新增行数降序排列的模型列表 */
  const modelEntries = createMemo(() => {
    const c = contrib()
    if (!c) return []
    return [...c.byModel].sort((a, b) => b.added - a.added)
  })

  /** 模型间最大新增行数，用于条状图缩放 */
  const maxModelAdded = createMemo(() => {
    const entries = modelEntries()
    return entries.length > 0 ? Math.max(...entries.map((m) => m.added)) : 1
  })

  /** 文件间最大变更量（新增+删除），用于热门文件条状图缩放 */
  const maxFileTotal = createMemo(() => {
    const c = contrib()
    return c && c.topFiles.length > 0 ? Math.max(...c.topFiles.map((f) => f.added + f.deleted)) : 1
  })

  /** Opencode 工具总计新增/删除行数 */
  const toolAdded = createMemo(() => modelEntries().reduce((s, m) => s + m.added, 0))
  const toolDeleted = createMemo(() => modelEntries().reduce((s, m) => s + m.deleted, 0))

  /** AI 文件占比：AI 触及文件数 / 仓库总文件数 */
  const fileRatio = createMemo(() => {
    const c = contrib()
    if (!c || c.totalFiles === 0) return "0.0"
    return ((c.aiTouchedFiles / c.totalFiles) * 100).toFixed(1)
  })

  /** AI 行数占比：AI 贡献行数 / 仓库总行数 */
  const lineRatio = createMemo(() => {
    const c = contrib()
    if (!c || c.totalLines === 0) return "0.0"
    return ((c.aiContributedLines / c.totalLines) * 100).toFixed(1)
  })

  /**
   * 贡献分布条状图分段数据。
   * 按各模型 AI 行数比例计算宽度，剩余部分为「未知/人工」灰色段。
   */
  const barSegments = createMemo(() => {
    const c = contrib()
    if (!c || c.totalLines === 0 || c.aiContributedLines === 0) return []
    const models = modelEntries()
    const totalAi = toolAdded()
    if (totalAi === 0) return []

    const barWidth = Math.min(48, Math.max(20, dimensions().width - 10))
    const humanLines = c.totalLines - c.aiContributedLines

    const segments: { label: string; width: number; fg: RGBA; value: number; pct: string }[] = []
    for (const m of models) {
      const share = Math.round(c.aiContributedLines * (m.added / totalAi))
      if (share === 0) continue
      segments.push({
        label: m.model,
        width: Math.max(1, Math.round((share / c.totalLines) * barWidth)),
        fg: theme.success,
        value: share,
        pct: ((share / c.totalLines) * 100).toFixed(1),
      })
    }

    // 非 AI 贡献的剩余行数
    if (humanLines > 0) {
      segments.push({
        label: "未知/人工",
        width: Math.max(1, Math.round((humanLines / c.totalLines) * barWidth)),
        fg: theme.textMuted,
        value: humanLines,
        pct: ((humanLines / c.totalLines) * 100).toFixed(1),
      })
    }

    // 补齐舍入误差
    const totalSegWidth = segments.reduce((s, seg) => s + seg.width, 0)
    if (totalSegWidth !== barWidth && segments.length > 0) {
      segments[segments.length - 1].width += barWidth - totalSegWidth
    }

    return segments
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
          <text fg={theme.textMuted}> - 点击任意处关闭</text>
        </box>

        <Show when={!contrib() || contrib()!.sessions === 0}>
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <text fg={theme.textMuted}>暂无贡献数据。</text>
          </box>
        </Show>

        {/** 有数据时展示完整报告 */}
        <Show when={contrib() && contrib()!.sessions > 0}>
          <scrollbox flexGrow={1}>
            <box flexDirection="column" paddingX={2} paddingY={1}>

              {/* ── 概览：对标 ai-credit 的三行表格 ── */}
              <text fg={theme.accent}>概览</text>
              <box flexDirection="column" paddingTop={1}>
                <box flexDirection="row" gap={3}>
                  <box width={10}><text fg={theme.text}>总文件数</text></box>
                  <box width={8}><text fg={theme.text}>{contrib()!.totalFiles}</text></box>
                  <box flexGrow={1}>
                    <text fg={theme.success}>{contrib()!.aiTouchedFiles} </text>
                    <text fg={theme.textMuted}>({fileRatio()}%)</text>
                  </box>
                </box>
                <box flexDirection="row" gap={3}>
                  <box width={10}><text fg={theme.text}>总行数</text></box>
                  <box width={8}><text fg={theme.text}>{human(contrib()!.totalLines)}</text></box>
                  <box flexGrow={1}>
                    <text fg={theme.success}>{human(contrib()!.aiContributedLines)} </text>
                    <text fg={theme.textMuted}>({lineRatio()}%)</text>
                  </box>
                </box>
                <box flexDirection="row" gap={3}>
                  <box width={10}><text fg={theme.text}>AI 会话数</text></box>
                  <box width={8}><text fg={theme.text}>{contrib()!.sessions}</text></box>
                  <box flexGrow={1}><text fg={theme.textMuted}>-</text></box>
                </box>
              </box>

              {/* ── AI 工具贡献：工具行 + 模型子行 + 条状图 ── */}
              <Show when={modelEntries().length > 0}>
                <box height={1} backgroundColor={theme.border} marginTop={1} marginBottom={1} />
                <text fg={theme.accent}>AI 工具贡献</text>
                <box flexDirection="column" paddingTop={1}>
                  <box flexDirection="row" gap={2}>
                    <box width={22}><text fg={theme.textMuted}>工具 / 模型</text></box>
                    <box width={6}><text fg={theme.textMuted}>会话</text></box>
                    <box width={8}><text fg={theme.textMuted}>新增</text></box>
                    <box width={8}><text fg={theme.textMuted}>删除</text></box>
                    <box flexGrow={1}><text fg={theme.textMuted}>占比</text></box>
                  </box>
                  <box flexDirection="row" gap={2}>
                    <box width={22}><text fg={theme.text}>Opencode</text></box>
                    <box width={6}><text fg={theme.text}>{contrib()!.sessions}</text></box>
                    <box width={8}><text fg={theme.success}>+{toolAdded()}</text></box>
                    <box width={8}><text fg={theme.error}>{toolDeleted()}</text></box>
                    <box flexGrow={1}><text fg={theme.text}>100.0%</text></box>
                  </box>
                  <For each={modelEntries()}>
                    {(m) => {
                      const share = toolAdded() > 0 ? ((m.added / toolAdded()) * 100).toFixed(1) : "0.0"
                      const barLen = maxModelAdded() > 0 ? Math.max(1, Math.round((m.added / maxModelAdded()) * 16)) : 1
                      return (
                        <box flexDirection="row" gap={2}>
                          <box width={22}><text fg={theme.textMuted}>  {"\u2514"} {m.model}</text></box>
                          <box width={6}><text fg={theme.textMuted}>{m.sessions}</text></box>
                          <box width={8}><text fg={theme.textMuted}>+{m.added}</text></box>
                          <box width={8}><text fg={theme.textMuted}>{m.deleted}</text></box>
                          <box flexGrow={1}>
                            <text fg={theme.textMuted}>{share}% </text>
                            <text fg={theme.border}>{"\u2588".repeat(barLen)}</text>
                          </box>
                        </box>
                      )
                    }}
                  </For>
                </box>
              </Show>

              {/* ── 贡献分布：堆叠条状图 + 图例 ── */}
              <Show when={contrib()!.totalLines > 0 && contrib()!.aiContributedLines > 0 && barSegments().length > 0}>
                <box height={1} backgroundColor={theme.border} marginTop={1} marginBottom={1} />
                <text fg={theme.accent}>贡献分布</text>
                <box flexDirection="column" paddingTop={1}>
                  <box flexDirection="row" height={1}>
                    <For each={barSegments()}>
                      {(seg) => <text fg={seg.fg}>{"\u2588".repeat(seg.width)}</text>}
                    </For>
                  </box>
                  <For each={barSegments()}>
                    {(seg) => (
                      <box flexDirection="row" gap={1}>
                        <text fg={seg.fg}>{"\u25cf"}</text>
                        <text fg={theme.text}>{seg.label}</text>
                        <text fg={theme.textMuted}>{seg.pct}%</text>
                        <text fg={theme.textMuted}>({human(seg.value)} lines)</text>
                      </box>
                    )}
                  </For>
                </box>
              </Show>

              {/* ── 热门文件 Top 15 ── */}
              <Show when={contrib()!.topFiles.length > 0}>
                <box height={1} backgroundColor={theme.border} marginTop={1} marginBottom={1} />
                <text fg={theme.accent}>热门文件</text>
                <box flexDirection="column" paddingTop={1}>
                  <For each={contrib()!.topFiles.slice(0, 15)}>
                    {(f) => {
                      const total = f.added + f.deleted
                      const barLen = Math.max(1, Math.round((total / maxFileTotal()) * 16))
                      const displayPath = f.file.length > 28 ? "..." + f.file.slice(-25) : f.file
                      const ratioStr = (f.ratio * 100).toFixed(1) + "%"
                      return (
                        <box flexDirection="row" gap={1}>
                          <box width={28} overflow="hidden">
                            <text fg={theme.text} wrapMode="none">{displayPath}</text>
                          </box>
                          <text fg={theme.success}>+{f.added}</text>
                          <text fg={theme.textMuted}>/</text>
                          <text fg={theme.error}>{f.deleted}</text>
                          <text fg={theme.textMuted}> {ratioStr}</text>
                          <text fg={theme.border}>{"\u2588".repeat(barLen)}</text>
                        </box>
                      )
                    }}
                  </For>
                </box>
              </Show>

              {/* ── 最近会话 Top 10 ── */}
              <Show when={contrib()!.recentSessions.length > 0}>
                <box height={1} backgroundColor={theme.border} marginTop={1} marginBottom={1} />
                <text fg={theme.accent}>最近会话</text>
                <box flexDirection="column" paddingTop={1}>
                  <For each={contrib()!.recentSessions.slice(-10).reverse()}>
                    {(s) => (
                      <box flexDirection="row" gap={1}>
                        <box width={14} flexShrink={0}>
                          <text fg={theme.textMuted}>{Locale.todayTimeOrDateTime(s.time)}</text>
                        </box>
                        <box width={22} overflow="hidden">
                          <text fg={theme.text} wrapMode="none">{s.title}</text>
                        </box>
                        <text fg={theme.success}>+{s.added}</text>
                        <text fg={theme.textMuted}>/</text>
                        <text fg={theme.error}>{s.deleted}</text>
                        <text fg={theme.textMuted}> {s.model}</text>
                      </box>
                    )}
                  </For>
                </box>
              </Show>

            </box>
          </scrollbox>
        </Show>
      </box>
    </box>
  )
}
