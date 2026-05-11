# 自定义 Schema 与 Skill

## 概述

允许用户在 TUI 中创建自定义 OpenSpec 工作流（Schema），并自动生成对应的 slash 命令和 AI skill。支持程序化和 AI 引导两种创建方式。

## Schema 系统

### 定义

Schema 定义在 YAML 文件中，描述工作流的制品序列、依赖关系和生成规则。

**内置默认 Schema**:

```yaml
# packages/opencode/src/openspec/builtin/schemas/spec-driven/schema.yaml
name: spec-driven
version: 1
description: Default OpenSpec workflow - proposal → specs → design → tasks
artifacts:
  - id: proposal
    generates: proposal.md
    template: proposal.md
    instruction: "Create the proposal document..."
    requires: []
  - id: specs
    generates: "specs/**/*.md"
    template: spec.md
    requires: [proposal]
  - id: design
    generates: design.md
    template: design.md
    requires: [proposal]
  - id: tasks
    generates: tasks.md
    template: tasks.md
    requires: [specs, design]
apply:
  requires: [tasks]
  tracks: tasks.md
```

### 三层注册表（查找优先级）

| 层级 | 位置 | 说明 |
|------|------|------|
| 1. Builtin | `src/openspec/builtin/schemas/<name>/` | 随 OpenCode 发布 |
| 2. Project | `.openspec/schemas/<name>/` | 用户 fork/init 创建的 |
| 3. Global | `~/.config/openspec/schemas/<name>/` | 全局共享 |

## 创建方式

### 方式一：程序化（CLI）

```bash
opencode openspec schema init tdd-driven \
  --description "TDD workflow" \
  --artifacts spec,tests,implementation \
  --generate-skills
```

`--generate-skills` 标志会额外生成：
- `.opencode/commands/tdd-driven.md` → 出现在 `/` 补全
- `.opencode/skills/tdd-driven/SKILL.md` → AI 可通过 `skill` 工具加载

### 方式二：AI 引导（TUI）

```
/openspec-schema-init
```

AI 会逐步询问：名称 → 描述 → 制品列表 → 确认 → 自动生成所有文件。

## Skill 注册机制

Skill 文件（SKILL.md）通过 YAML frontmatter 定义：

```markdown
---
name: tdd-propose
description: Create a TDD change proposal
---

## Steps
1. Create change: `opencode openspec new change "<name>" --schema tdd-driven`
2. Check status...
```

OpenCode 自动发现路径：

| 路径 | 用途 | Automplete |
|------|------|:---------:|
| `.opencode/skills/<name>/SKILL.md` | AI 可加载（`skill` 工具），也注册为命令 | `/全名` 可执行 |
| `.opencode/commands/<name>.md` | 仅注册为 slash 命令 | `/name` 有补全 |
| `packages/opencode/src/openspec/builtin/skills/` | 内置 skill（编译时嵌入） | `/openspec-*` 有补全 |

## 文件清单

| 文件 | 用途 |
|------|------|
| `src/openspec/schema.ts` | `schema.yaml` 解析 + `loadSchema()` + `listSchemas()` |
| `src/cli/cmd/openspec.ts` | `schema init --generate-skills` / `schema fork` |
| `src/openspec/builtin/skills/openspec-schema-init/SKILL.md` | `/openspec-schema-init` AI 引导 skill |
