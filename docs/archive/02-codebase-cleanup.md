# 项目精简

## 概述

将 OpenCode 项目从全功能 monorepo 精简为 TUI-only 架构，移除 web/desktop/enterprise/console 等非 TUI 组件。

## 删除的 workspace 包

| 包 | 路径 | 原因 |
|----|------|------|
| app | `packages/app/` | Web UI （SolidJS 前端） |
| ui | `packages/ui/` | 共享 UI 组件库 |
| desktop | `packages/desktop/` | Tauri 桌面 |
| desktop-electron | `packages/desktop-electron/` | Electron 桌面 |
| enterprise | `packages/enterprise/` | 企业版 |
| web | `packages/web/` | Astro 文档站 |
| storybook | `packages/storybook/` | Storybook UI |
| slack | `packages/slack/` | Slack 机器人 |
| function | `packages/function/` | Serverless 函数 |
| console | `packages/console/*` | 管理后台 |

## 保留的 5 个核心包

```
packages/core/        # 共享 Effect 工具库
packages/script/      # 构建脚本
packages/sdk/js/      # API 客户端
packages/plugin/      # 插件类型定义
packages/opencode/    # CLI + TUI + Server + OpenSpec
```

## 删除的死代码

| 文件/目录 | 行数/大小 | 证据 |
|-----------|-----------|------|
| `src/acp/` | ~800 行 | 仅用于独立 `acp` CLI 命令，不被 TUI 或 server 导入 |
| `src/ide/` | ~1200 行 | **全项目 0 引用** |
| `src/node.ts` | 32 行 | 0 引用 |
| `src/temporary.ts` | 44 行 | 0 引用 |

## 删除的独立 CLI 命令

从 `src/index.ts` 中移除 17 个 CLI 子命令注册。保留 `run`、`openspec`、`db`、`debug`、`tui:thread`、`tui:attach`。

| 删除的命令 | 用途 |
|-----------|------|
| `account` | Console 登录 |
| `agent` | 管理 Agent |
| `export` / `import` | 会话导入导出 |
| `generate` | SDK 代码生成 |
| `github` | GitHub Actions |
| `mcp` | MCP 管理 |
| `models` | 模型列表 |
| `plug` | 插件管理 |
| `pr` | PR 管理 |
| `providers` | Provider 管理 |
| `serve` | 独立 API server |
| `session` | Session 管理 |
| `stats` | 统计 |
| `uninstall` / `upgrade` | 卸载/升级 |
| `web` | Web 模式 |

## 删除的测试文件

| 测试文件 | 关联删除对象 |
|----------|-------------|
| `test/acp/*` | ACP 模块 |
| `test/ide/*` | IDE 模块 |
| `test/cli/account.test.ts` | account 命令 |
| `test/cli/github-*.test.ts` | github 命令 |
| `test/cli/import.test.ts` | import 命令 |
| `test/cli/plugin-auth-picker.test.ts` | providers 命令 |
| `test/plugin/install.test.ts` | plug 命令 |
| `test/fixture/plug-worker.ts` | plug 命令 |

## 根 package.json 变更

- `workspaces` 从 `["packages/*", "packages/console/*", "packages/sdk/js", "packages/slack"]` 精简为 5 个具体包
- `scripts` 移除 `dev:desktop`、`dev:web`、`dev:console`、`dev:storybook`
- `typecheck` 从 `bun turbo typecheck` 改为 `bun run --cwd packages/opencode typecheck`
- `catalog` 移除 15+ 个不再被引用的依赖版本
- `trustedDependencies` 移除 `electron`
- 根 `dependencies` 移除 `@aws-sdk/client-s3`
