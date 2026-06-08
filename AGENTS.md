- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## 项目架构

这是一个 monorepo，包含三个核心包：

| 包名 | 运行时 | 说明 |
|------|--------|------|
| `packages/opencode` | Bun (Node) | 后端服务器 + **CLI 终端界面** |
| `packages/app` | 浏览器 | SolidJS Web 前端 |
| `packages/sdk` | 两者 | 共享 JS SDK (`@opencode-ai/sdk/v2`) |

### `packages/opencode` — 后端 + CLI 终端界面

- 入口文件：`packages/opencode/src/index.ts`
- 默认命令 (`$0`) 是 `TuiThreadCommand`，用于启动交互式终端界面。
- CLI 终端界面使用 `@opentui/solid`（将 SolidJS 组件渲染到终端）+ `@opentui/core`（终端渲染引擎）。
- 关键 TUI 文件（相对于 `packages/opencode/src/cli/cmd/tui/`）：
  - `component/prompt/index.tsx` — 用户文本输入、提交、按键处理
  - `routes/session/index.tsx` — 聊天视图：消息渲染（UserMessage、AssistantMessage、工具结果）
  - `routes/home.tsx` — 首页/欢迎界面
  - `context/sdk.tsx` — API 客户端 + SSE 事件流
  - `thread.ts` — 启动 Worker 线程（后端服务器）+ 调用 `tui()` 启动终端界面
  - `worker.ts` — Worker 线程，进程内运行 Hono HTTP 服务器
  - `app.tsx` — `tui()` 启动逻辑 + `<App>` 根组件
- 后端服务（相对于 `packages/opencode/src/`）：
  - `pty/index.ts` — PTY 进程管理（node-pty 生成子进程、WebSocket、缓冲区）
  - `server/routes/instance/pty.ts` — PTY REST + WebSocket 路由
- 导入别名 `@tui/*` 对应 `src/cli/cmd/tui/*`（通过 tsconfig paths 配置）。

### `packages/app` — Web 前端

- SolidJS 浏览器应用，使用 Vite 构建（`vite-plugin-solid`）。
- `packages/app/src/` 下的所有代码均运行在浏览器中。
- 使用 `contenteditable` div 作为输入框，而非 `<textarea>`。
- 通过 `ghostty-web` 实现基于 WebSocket 的终端。
- 关键文件：
  - `src/components/prompt-input.tsx` — 富文本输入，支持 @提及、/命令
  - `src/components/prompt-input/submit.ts` — 提交流程编排（创建会话、分发消息）
  - `src/components/terminal.tsx` — Ghostty-web 终端模拟器 + WebSocket
  - `src/context/prompt.tsx` — Prompt 状态管理
  - `src/context/terminal.tsx` — 终端会话管理

### 调试

- **CLI 终端界面** (`packages/opencode/src/cli/cmd/tui/`)：运行在 Bun 中。使用 `bun run dev:inspect`（在 ws://localhost:6499/ 上附加 Bun 调试器）+ VS Code F5。
  - **注意**：`@opentui/solid` 的自定义 JSX 运行时会导致 `.tsx` 文件的源码映射（source map）错位，VS Code 手动设置的断点**可能不会命中**。此时需使用 `debugger;` 语句代替手动断点，`debugger;` 不受 JSX 转换影响。
- **后端服务** (`packages/opencode/src/`)：运行在 **Worker 线程**中（`thread.ts:144` 通过 `new Worker()` 创建）。`--inspect` 仅调试主线程，Worker 线程中的 `debugger;` 或断点**不会生效**。需在 `worker.ts` 中显式开启 Worker 线程的调试器。
- **Web 前端** (`packages/app/src/`)：运行在浏览器中。使用浏览器 DevTools（F12 → Sources）或添加 `debugger;` 语句。Bun 调试器**看不到**这些代码。
- **`bun run dev:inspect`** 对应 `packages/opencode` 的脚本：`bun run --inspect=ws://localhost:6499/ --conditions=browser ./src/index.ts`。

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- In `src/config`, follow the existing self-export pattern at the top of the file (for example `export * as ConfigAgent from "./agent"`) when adding a new config module.

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.
