# Flow 模式

## 概述

Flow 模式是 AI 驱动的需求到代码工作流。用户勾选 PRD + GitLab 仓库后，按顺序流转 4 个提示词模板步骤：技术方案 → spec-change → design/task → 代码生成。AI 自动创建 git worktree、拉取代码、为每个步骤生成对应的产物，最终提交到分支。

Flow 和 Chat 共享同一个 Session 组件——模式切换仅更换侧边栏，消息渲染完全一致，展示思考过程、工具调用等完整会话信息。

## 路由架构

### SessionRoute 新增 mode 字段

**文件**: `packages/opencode/src/cli/cmd/tui/context/route.tsx`

```ts
export type SessionRoute = {
  type: "session"
  sessionID: string
  prompt?: PromptInfo
  mode?: "chat" | "flow"   // ← 新字段
}
```

- Chat 模式: `{ type: "session", sessionID }`
- Flow 模式: `{ type: "session", sessionID, mode: "flow" }`
- `FlowRoute` 已删除，不再作为独立路由类型
- `/flow` 命令: home → 创建 session → navigate 到 `{ mode: "flow" }`
- `/chat` 命令: flow → navigate 到 `{ mode: undefined }` (即 chat)

### 共享 Session 组件

**文件**: `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`

```
┌──────┬──────────────────────────┐
│ Chat │ 会话列表                 │   ← mode = "chat"
│ mode │ Prompt Templates 插件    │
├──────┼──────────────────────────┤
│ Flow │ PRD / GitLab / Workflow  │   ← mode = "flow"
│ mode │                          │
└──────┴──────────────────────────┘
```

侧边栏根据 `isFlowMode()` 条件渲染:

```
isFlowMode() === true  → <FlowSidebar />
isFlowMode() === false → <Sidebar sessionID={...} />
```

### 路由切换命令

| 命令 | 行为 |
|------|------|
| `/flow` | 从 home 创建 session 并进入 flow；从 chat 切换到 flow |
| `/chat` | 从 flow 切回 chat（mode 还原为 undefined） |

## Flow 侧边栏

**文件**: `packages/opencode/src/cli/cmd/tui/routes/flow/flow-sidebar.tsx`

### 三分区布局

```
▼ PRD                    (N)
  ○ PRD-001: 商城系统重构
  ● PRD-002: 用户中心V2   ← 可勾选

▼ GitLab                 (N)
  ○ group/project-a
  ● group/project-b       ← 可勾选

+ 创建分支 & 拉取代码      ← PRD + 仓库同时选中时显示

▼ Workflow               ← 可折叠
  ●✓ ✓ 步骤1 (当前高亮)
  ○✓ ✗ 步骤2
  ○✓ ✗ 步骤3
  ○✓ ✗ 步骤4
─────────────────
PRD: ✓  Repo: ✓
[Switch to Chat]
```

### PRD 列表

**文件**: `packages/opencode/src/cli/cmd/tui/routes/flow/config.ts`

```ts
export const MOCK_PRDS = [
  { id: "1", name: "PRD-001", title: "商城系统重构" },
  { id: "2", name: "PRD-002", title: "用户中心V2" },
  // ...共 5 个
]
```

初期写死，后续可对接 PRD 管理平台的 HTTP API（`PRIVATE-TOKEN` 认证）。

### GitLab 仓库列表

```ts
export const GITLAB_CONFIG = {
  baseUrl: "http://git.edianzu.cn/api/v4",
  token: "uw6kenLKViJyTQi7An11",
  apiPath: "/projects",
  params: "membership=true&per_page=100&simple=true&fields=id,path_with_namespace,name",
}
```

通过 GitLab API 获取仓库列表，`onMount` 时自动 fetch。显示 `path_with_namespace`，可勾选。

### 创建分支 & 拉取代码

**配置**: `packages/opencode/src/cli/cmd/tui/routes/flow/config.ts:buildCreateBranchPrompt()`

点击后向 prompt 注入指令：

```
## 任务
为 GitLab 仓库 {repoPath} 创建工作树，基于 dev 创建特性分支并设置为当前工作区。

PRD: {prdTitle}

## 要求
1. 使用 git clone http://oauth2:{TOKEN}@git.edianzu.cn/{repoPath}.git 克隆到本地
2. 使用 git worktree add 创建新工作树，分支名规则: flow/{PRD特点}-{仓库简称}-{MMDD}
3. 新分支基于 dev 分支创建
4. 将工作树目录设置为当前工作区
```

- HTTPS + Token 认证，免 SSH 交互
- 使用 git worktree 支持并行开发
- 分支名由 AI 自动生成，前端不再预生成名称

## Workflow 工作流

**文件**: `packages/opencode/src/cli/cmd/tui/routes/flow/workflow.tsx`

### 步骤配置

**文件**: `packages/opencode/src/cli/cmd/tui/routes/flow/config.ts`

```ts
export const FLOW_STEPS: FlowStep[] = [
  { key: "step1", label: "根据PRD+仓库地址+知识库，生成技术方案", templateName: "flow-step1" },
  { key: "step2", label: "根据技术方案生成spec-change",                templateName: "flow-step2" },
  { key: "step3", label: "根据change分别生成design/task",              templateName: "flow-step3" },
  { key: "step4", label: "根据task生成代码",                           templateName: "flow-step4" },
]
```

后续可 KV 持久化用户自定义步序。

### 高亮流程

- `activeStep` signal（初始 0）：当前可点击的高亮步骤
- `completed` signal（Set<number>）：已完成步骤
- 步骤指示器: 当前步 `●` | 已完成 `✓` | 未完成 `○`
- 模板可用: `✓` 绿色 | `✗` 灰色（模板文件缺失时降级到 label）

### 点击步骤

1. `loadTemplateContent(templateName)` → 先搜 `templates/local/`，再搜远程 repo
2. 找到模板 → 注入模板正文到 prompt 输入框
3. 未找到 → 降级到 `step.label` 作为 prompt
4. 自动推进高亮到下一步

### 展开时自动刷新

`onMount` 中: `seedFlowTemplates()` → 检查模板可用性 → 更新 `✓`/`✗` 指示器。

## 提示词模板

### 模板库同源

Flow 页 Workflow 和 Chat 页 Prompt Templates 侧边栏共享同一模板库:

```
templates/local/
├── flow-step1.md    →  step1 模板
├── flow-step2.md    →  step2 模板
├── flow-step3.md    →  step3 模板
├── flow-step4.md    →  step4 模板
└── ... (其他用户模板)
```

模板格式: YAML frontmatter + markdown 正文

```markdown
---
name: flow-step1
description: 根据PRD+仓库地址+知识库，生成技术方案
---

根据PRD+仓库地址+知识库，生成技术方案
```

### 自动补种

**文件**: `packages/opencode/src/template/seed.ts`

```ts
export async function seedFlowTemplates(steps: FlowStep[]) {
  for (const step of steps) {
    const exists = templates.some(t => t.name === step.templateName)
    if (exists) continue  // 用户已编辑则不覆盖
    await TemplateFile.createTemplate(localDir, step.templateName, step.label, step.label)
  }
}
```

- 首次展开 Workflow → 4 个 `.md` 自动写入本地模板目录
- 跨平台（Windows/Linux/Mac）自动运行
- 模板已存在时跳过，保护用户编辑内容

## 消息追踪

### Flow / Chat 标签

Flow 页 active 期间新出现的消息标记为 `[Flow]`，其他为 `[Chat]`。

**KV 持久化**: `flow_msg_{sessionID}` → `string[]`（flow 消息 ID 列表）

### 追踪逻辑 (`session/index.tsx`)

```tsx
onMount(() => {
  if (!isFlowMode()) return
  setFlowSeenIds(new Set(existing.map(m => m.id)))
})

createEffect(() => {
  if (!isFlowMode()) return
  const msgs = messages()
  const newMsgs = msgs.filter(m => !seenIds().has(m.id))
  if (newMsgs.length > 0) setFlowMsgIds([...prev, ...newIds])
})
```

### 标签渲染

Session 组件 context 新增 `flowSet: () => Set<string>` 字段。`UserMessage` 和 `AssistantMessage` 通过 `ctx.flowSet().has(id)` 判断显示 `[Flow]` 或 `[Chat]`。

| 场景 | 行为 |
|------|------|
| Flow 页发送消息 | `createEffect` 检测 → 加入 flowMsgIds → `[Flow]` |
| Chat 页发送消息 | Flow 组件不在 active → 不追踪 → `[Chat]` |
| 切回 Flow 再发 | `onMount` 重置 seenIds → 新消息 `[Flow]` |

## 独立二进制编译修复

需编译成独立二进制部署到 Linux VM。共修复 4 个文件:

| 文件 | 问题 | 修复 |
|------|------|------|
| `src/template/auth.ts` | `require()` 无法加载含 top-level await 的模块 | 改为顶层 `import` |
| `src/template/git.ts` | 同上 | 同上 |
| `src/openspec/builtin.ts` | `SKILLS_DIR` 路径错误 + 文件缺失抛异常 | 路径修正 + `try/catch` 容错 |
| `script/build.ts` | skills 文件未嵌入虚拟文件系统 | 扫描 `builtin/skills/**/SKILL.md` → `with { type: "file" }` 嵌入 |

### 编译命令

```bash
cd packages/opencode && bun run script/build.ts --single --skip-embed-web-ui
```

### 部署

```bash
sudo cp dist/opencode-linux-x64/bin/opencode /usr/local/bin/opencode
sudo chmod +x /usr/local/bin/opencode
```

## 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/cli/cmd/tui/routes/flow/config.ts` | Flow 配置（PRD mock、GitLab API、FLOW_STEPS） |
| `packages/opencode/src/cli/cmd/tui/routes/flow/flow-sidebar.tsx` | Flow 侧边栏（PRD/GitLab/Workflow 三分区） |
| `packages/opencode/src/cli/cmd/tui/routes/flow/workflow.tsx` | Workflow 工作流步骤组件 |
| `packages/opencode/src/template/seed.ts` | 模板自动补种函数 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `packages/opencode/src/cli/cmd/tui/context/route.tsx` | SessionRoute + `mode` 字段；删除 `FlowRoute` |
| `packages/opencode/src/cli/cmd/tui/app.tsx` | 删除 Flow 路由匹配；更新 `/flow` 命令为 navigate+mode |
| `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` | +isFlowMode/+flow state/+追踪/+FlowSidebar 渲染/+命令 |
| `packages/opencode/src/cli/cmd/tui/plugin/api.tsx` | routeNavigate/routeCurrent 恢复原始逻辑 |
| `packages/opencode/src/template/auth.ts` | `require()` → `import`（fix 编译） |
| `packages/opencode/src/template/git.ts` | `require()` → `import`（fix 编译） |
| `packages/opencode/src/openspec/builtin.ts` | 路径修正 + `try/catch`（fix 编译） |
| `packages/opencode/script/build.ts` | skills 文件嵌入虚拟文件系统（fix 编译） |

### 删除文件

| 文件 | 说明 |
|------|------|
| `packages/opencode/src/cli/cmd/tui/routes/flow/index.tsx` | Flow 独立页面（不再需要，共用 Session） |
| `packages/opencode/src/cli/cmd/tui/routes/flow/message-renderer.tsx` | Flow 专用消息渲染（不再需要） |
