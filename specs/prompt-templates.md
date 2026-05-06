# Prompt Templates

## Overview

为用户提供提示词模板功能，支持个人本地模板和远程团队模板仓库两种模式。

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        TUI Sidebar Plugin                        │
│  PromptTemplatesPlugin (feature-plugins/sidebar/)                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Prompt Templates ▼                                      │   │
│  │  > Local (3)                      ← 个人本地模板         │   │
│  │    + 创建模板                                              │   │
│  │    daily-review.md                                         │   │
│  │    code-review.md                                          │   │
│  │    - 删除                                                  │   │
│  │  ─────────────────────                                    │   │
│  │  > team-frontend (21)             ← 远程仓库模板          │   │
│  │    + 创建模板                                              │   │
│  │    react-form.md                                           │   │
│  │    api-route.md                                            │   │
│  │    - 删除                                                  │   │
│  │    [Submit MR]                                              │   │
│  │  ─────────────────────                                    │   │
│  │  [+ Add Repository]               ← 添加远程仓库          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │              │               │
         ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  create .md  │ │  click .md   │ │ add repo     │
│  → write     │ │  → read      │ │ → git clone  │
│  local file  │ │  frontmatter │ │ → auth       │
│              │ │  → inject    │ │              │
│              │ │  to prompt   │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Storage Layout

```
~/.local/share/opencode/templates/          ← Global.Path.data + "/templates"
├── repos.json                              ← 仓库列表（添加的远程仓库元数据）
└── local/                                  ← 个人本地模板目录
│   ├── daily-review.md
│   └── code-review.md
├── team-frontend/                          ← 远程仓库（git clone 完整工作副本）
│   ├── .git/
│   ├── react-form.md
│   └── api-route.md
└── team-backend/
    ├── .git/
    ├── ...
```

### repos.json

```jsonc
// ~/.local/share/opencode/templates/repos.json
// 管理已添加的远程仓库列表
{
  "repos": [
    {
      "name": "team-frontend",
      "url": "https://github.com/team/frontend-templates.git",
      "description": "前端团队模板",
      "added_at": 1715000000000
    },
    {
      "name": "team-backend",
      "url": "git@github.com:team/backend-templates.git",
      "description": "后端团队模板",
      "added_at": 1715000000001
    }
  ]
}
```

### Template .md format

```markdown
---
name: daily-review
description: 每日代码审查
---

Please review the following code changes:
...
```

## Modules

### 1. `src/template/repo.ts` — 仓库管理

```typescript
export const REPOS_FILE: string  // Global.Path.data + "/templates/repos.json"

export type RepoEntry = {
  name: string          // 目录名，如 "team-frontend"
  url: string           // git 仓库 URL
  description?: string
  added_at: number
}

// repos.json 读写
export function loadRepos(): Promise<RepoEntry[]>
export function saveRepos(repos: RepoEntry[]): Promise<void>
export function addRepo(name: string, url: string, description?: string): Promise<void>
export function removeRepo(name: string): Promise<void>
```

Logging:
- `TemplateRepo.load: loaded {n} repos from {path}`
- `TemplateRepo.save: saved {n} repos to {path}`
- `TemplateRepo.add: added repo {name} ({url})`
- `TemplateRepo.remove: removed repo {name}`

### 2. `src/template/file.ts` — 模板文件 CRUD

```typescript
export type TemplateMeta = {
  name: string
  description?: string
}

export type TemplateEntry = {
  name: string            // 文件名（不含 .md）
  description?: string
  content: string         // frontmatter 下方的正文
  filePath: string        // 完整路径
  repo: "local" | string  // "local" 或仓库名
}

// 列出目录下所有 .md 模板
export function listTemplates(dir: string): Promise<TemplateEntry[]>

// 读取单个 .md 文件，解析 frontmatter + content
export function readTemplate(filePath: string): Promise<TemplateEntry>

// 创建 .md 模板文件（自动生成 frontmatter）
export function createTemplate(dir: string, name: string, content: string, description?: string): Promise<string>

// 删除 .md 模板文件
export function deleteTemplate(filePath: string): Promise<void>
```

Logging:
- `TemplateFile.list: found {n} templates in {dir}`
- `TemplateFile.read: read template {filePath}`
- `TemplateFile.create: created template {filePath}`
- `TemplateFile.delete: deleted template {filePath}`

### 3. `src/template/git.ts` — 远程仓库 git 操作

```typescript
// 克隆远程仓库到本地目录
// 如果 URL 中包含 token，嵌入到 HTTPS URL 中
export async function cloneRepo(url: string, dir: string, token?: string): Promise<void>

// 拉取远程更新（快进合并）
export async function pullRepo(dir: string): Promise<void>

// 创建新分支、add、commit、push
export async function submitMr(dir: string, branchName: string, message: string): Promise<void>
```

Git Error Handling:
- clone 失败：git auth 错误 → 提示"无权访问，请检查 Token"
- pull 失败：有本地未提交变更 → 提示"请先提交或暂存本地变更"
- push 失败：网络错误 → 提示"推送失败，请检查网络"

Logging:
- `TemplateGit.clone: cloning {url} to {dir}`
- `TemplateGit.clone: clone completed ({n} files)`
- `TemplateGit.clone: clone failed - {error}`
- `TemplateGit.pull: pulling in {dir}`
- `TemplateGit.pull: pull completed ({n} changes)`
- `TemplateGit.submitMr: creating branch {branch}, commit, push`
- `TemplateGit.submitMr: push completed, URL: {url}`

### 4. `src/template/auth.ts` — 仓库鉴权

```typescript
const AUTH_KEY_PREFIX = "template:"  // auth.json 中的 key 前缀

// 获取仓库的 Token
export async function getRepoToken(repoName: string): Promise<string | undefined>

// 存储仓库 Token
export async function setRepoToken(repoName: string, token: string): Promise<void>

// 检测是否需要鉴权（尝试克隆失败后调用）
export function needsAuth(error: string): boolean
```

Logging:
- `TemplateAuth.getToken: token found for repo {name}`
- `TemplateAuth.getToken: no token for repo {name}`
- `TemplateAuth.setToken: token saved for repo {name}`

### 5. TUI Plugin — `feature-plugins/sidebar/prompt-templates.tsx`

```
Component Tree:

TemplatesView
├── SectionHeader("Local", n)
├── LocalTemplateList
│   ├── AddButton (+)          → DialogPrompt: name + content → createTemplate()
│   ├── TemplateItem(name)     → onClick: readTemplate() → PromptRef.set()
│   │   └── DeleteButton (-)   → DialogConfirm → deleteTemplate()
├── Divider  (only if repos exist)
├── For each repo:
│   ├── SectionHeader(repo.name, n)
│   ├── RepoTemplateList
│   │   ├── AddButton (+)      → DialogPrompt → createTemplate() in repo dir
│   │   ├── TemplateItem(name) → onClick: inject
│   │   │   └── DeleteButton (-) → DialogConfirm → deleteTemplate()
│   │   └── SubmitMrButton     → onClick: git add/commit/push → toast
└── AddRepoButton              → DialogPrompt: name + url → cloneRepo()
    (only shown when no repos exist, or at bottom)
```

State Management:
- `createSignal<RepoEntry[]>([])` — 仓库列表，onMount 时从 repos.json 加载
- `createMemo` — 从文件系统实时读取 .md 列表
- onMount 时加载仓库列表和各仓库模板

Logging (plugin):
- `Templates: mounting plugin`
- `Templates: loaded {n} repos`
- `Templates: injecting template {name} from {repo}`
- `Templates: created template {name} in {dir}`
- `Templates: deleted template {path}`
- `Templates: submitted MR for repo {name}`
- `Templates: adding repo {name} ({url})`
- `Templates: removed repo {name}`

### 6. Plugin Registration — `plugin/internal.ts`

```typescript
import PromptTemplates from "../feature-plugins/sidebar/prompt-templates"

export const INTERNAL_TUI_PLUGINS = [
  ...
  PromptTemplates,
]
```

## Template Injection: PromptRef.set()

```
点击模板 →
  readTemplate(filePath)
    → 解析 frontmatter 获取 content（frontmatter 下方正文）
  → usePromptRef().current?.set({ input: content, parts: [] })
  → toast "已注入: {name}"
```

## Git Auth Flow: First-time Clone

```
用户点击 [Add Repository] →
  DialogPrompt: 输入 仓库URL + 名称 →
  
  if URL is https://:
    try git clone (no token)
    if 失败 (需要 auth):
      DialogPrompt: "请输入 Token" → 
      store token in auth.json →
      git clone https://token@host/repo.git →
      成功: 更新 repos.json
  
  if URL is git@...:
    try git clone
    if 需要 SSH key:
      DialogPrompt: "输入 SSH Key 路径 (留空使用默认 ~/.ssh/id_rsa)"
      GIT_SSH_COMMAND="ssh -i <key>" git clone ...
      成功: 更新 repos.json
```

## Submit MR Flow

```
用户点击 [Submit MR] →
  DialogPrompt: "MR 标题" (默认 "feat(templates): update prompt templates") →
  
  git branch = template-update-{timestamp}
  git checkout -b {branch}
  git add -A
  git commit -m {message}
  try git push origin {branch}
  
  成功 → toast "推送成功！请到 {repoUrl}/-/merge_requests/new 创建 MR"
  失败 → toast error message
```

## Local-only vs Remote-repo Templates

| Feature | Local | Remote Repo |
|---------|-------|-------------|
| Storage | `templates/local/*.md` | `templates/<repo>/*.md` + `.git/` |
| Create | `+` → DialogPrompt → write .md | `+` → DialogPrompt → write .md |
| Delete | `-` → DialogConfirm → delete .md | `-` → DialogConfirm → delete .md |
| Edit | 暂不支持，手动编辑文件 | 暂不支持，手动编辑文件 |
| Submit | 无 | [Submit MR] → git push |
| Offline | 始终可用 | 克隆后离线可用（push 需网络）|
| Sync | N/A | 每次打开侧边栏时后台 git pull |

## Implementation Order

1. `src/template/repo.ts` — repos.json 读写（基础数据层）
2. `src/template/file.ts` — .md 模板文件 CRUD（基础数据层）
3. `src/template/auth.ts` — 仓库鉴权存储（复用 Auth 模块）
4. `src/template/git.ts` — git clone/pull/push 操作
5. `feature-plugins/sidebar/prompt-templates.tsx` — TUI 侧边栏插件
6. `plugin/internal.ts` — 注册插件

## Error Handling Strategy

All git operations are wrapped in try/catch with specific error messages:

- Git auth failure → "需要 git 鉴权，请检查 Token 或 SSH Key"
- Network failure → "网络连接失败，请检查网络"
- Local changes conflict → "有未提交的本地变更，请先处理"
- File system error → "文件读写失败：{error}"
- Frontmatter parse error → "模板格式错误：{error}"
