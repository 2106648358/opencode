# OpenSpec 内置集成

## 概述

将 OpenSpec 工作流系统作为原生模块集成到 OpenCode 中，提供 `/opsx-*` 系列 slash 命令用于结构化变更管理。无外部 npm 依赖（`@fission-ai/openspec`），完全基于 OpenCode 现有架构实现。

## 架构

```
用户输入 /opsx-propose
        │
        ▼
Command 服务 → 查询注册的命令列表
        │
        ▼
匹配 openspec-propose → 加载 SKILL.md 内容作为 prompt
        │
        ▼
AI 按 Skill 指令执行 bash 命令:
  opencode openspec new change "<name>"
  opencode openspec status --change "<name>" --json
  opencode openspec instructions <artifact> --change "<name>" --json
```

## 文件清单

### 核心引擎 (`packages/opencode/src/openspec/`)

| 文件 | 用途 |
|------|------|
| `schema.ts` | Schema YAML 解析、三层注册表（builtin/project/global）、模板加载 |
| `change.ts` | 变更 CRUD（创建/列表/归档/名称校验） |
| `artifact-graph.ts` | 制品依赖 DAG 计算、状态判定（done/ready/blocked）、指令生成 |
| `builtin.ts` | 11 个 SKILL.md 通过 `fs.readFileSync` 内嵌，导出 `BUILTIN_SKILLS` 数组 |

### 内置资源 (`packages/opencode/src/openspec/builtin/`)

```
schemas/spec-driven/
├── schema.yaml              # 默认工作流定义（proposal → specs → design → tasks）
└── templates/
    ├── proposal.md
    ├── spec.md
    ├── design.md
    └── tasks.md

skills/
├── openspec-propose/         # 一键创建全部制品
├── openspec-apply-change/    # 实施任务清单
├── openspec-new-change/      # 逐步创建变更
├── openspec-continue-change/ # 继续创建下一件制品
├── openspec-ff-change/       # 快速模式
├── openspec-explore/         # 探索模式
├── openspec-archive-change/  # 归档变更
├── openspec-sync-specs/      # 同步规格
├── openspec-verify-change/   # 校验实现
├── openspec-bulk-archive-change/ # 批量归档
├── openspec-onboard/         # 入职引导
└── openspec-schema-init/     # 可视化创建自定义 schema
```

### 其他修改

| 文件 | 变更 |
|------|------|
| `src/command/index.ts` | 导入 `BUILTIN_SKILLS`，注册为内置命令，`source: "command"` 绕过 autocomplete 过滤 |
| `src/skill/index.ts` | 导入 `BUILTIN_SKILLS`，加载到 skill 状态，供 AI `skill` 工具使用 |
| `src/cli/cmd/openspec.ts` | 注册 `opencode openspec` 子命令体系 |
| `src/index.ts` | 注册 `OpenSpecCommand` |
| `src/cli/cmd/tui/component/prompt/autocomplete.tsx` | 移除 `if (source === "skill") continue` 过滤行 |

## 命令体系

```
opencode openspec
├── new change <name> [--schema] [--description]
├── list [--json]
├── status --change <name> [--json]
├── instructions <artifact|apply> --change <name> [--json]
├── archive <name>
├── schema
│   ├── list [--json]
│   ├── fork <source> [name]
│   ├── init <name> [--artifacts] [--generate-skills] [--default]
│   ├── validate [name] [--verbose]
│   └── templates --schema <name> [--json]
├── show <name>
├── init
└── update
```

## 关键设计

- **注册链路**：`BUILTIN_SKILLS` → `command/index.ts`（`source: "command"`）→ TUI autocomplete 显示
- **Autocomplete 过滤**：原代码 `autocomplete.tsx:405` 跳过 `source === "skill"`，已删除该行
- **Skill 内容**：引用 `opencode openspec <cmd>` 而非 `openspec <cmd>`（原始 OpenSpec CLI 命令名）
