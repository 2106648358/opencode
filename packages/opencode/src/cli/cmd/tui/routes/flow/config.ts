export type PRDEntry = {
  id: string
  name: string
  title: string
}

export type GitLabRepo = {
  id: number
  path_with_namespace: string
  name: string
}

export type FlowStep = {
  key: string
  label: string
  templateName: string
}

export const MOCK_PRDS: PRDEntry[] = [
  { id: "1", name: "PRD-001", title: "商城系统重构" },
  { id: "2", name: "PRD-002", title: "用户中心V2" },
  { id: "3", name: "PRD-003", title: "订单管理优化" },
  { id: "4", name: "PRD-004", title: "支付网关升级" },
  { id: "5", name: "PRD-005", title: "数据中台建设" },
]

export const GITLAB_CONFIG = {
  baseUrl: "http://git.edianzu.cn/api/v4",
  token: "uw6kenLKViJyTQi7An11",
  apiPath: "/projects",
  params: "membership=true&per_page=100&simple=true&fields=id,path_with_namespace,name",
}

export const FLOW_STEPS: FlowStep[] = [
  { key: "step1", label: "根据PRD+仓库地址+知识库，生成技术方案", templateName: "flow-step1" },
  { key: "step2", label: "根据技术方案生成spec-change", templateName: "flow-step2" },
  { key: "step3", label: "根据change分别生成design/task", templateName: "flow-step3" },
  { key: "step4", label: "根据task生成代码", templateName: "flow-step4" },
]

export function buildCreateBranchPrompt(repoPath: string, prdTitle?: string) {
  const repoDir = repoPath.split("/").pop() ?? repoPath
  const tokenUrl = `http://oauth2:${GITLAB_CONFIG.token}@git.edianzu.cn/${repoPath}.git`
  const prdContext = prdTitle ? `PRD: ${prdTitle}\n` : ""
  return `## 任务
为 GitLab 仓库 ${repoPath} 创建工作树，基于 dev 创建特性分支并设置为当前工作区。

${prdContext}## 要求
1. 使用 git clone ${tokenUrl} 克隆到 ./${repoDir}（如本地已有则 pull 更新）
2. 使用 git worktree add 创建一个新的工作树，分支名按以下规则自动生成：flow/{PRD特点}-{仓库简称}-{MMDD}
3. 新分支基于 dev 分支创建
4. 将工作树目录设置为当前工作区

## 说明
- 使用 git worktree 而非直接 clone，以便后续针对同一仓库的多个特性并行开发
- 工作树目录命名建议：./${repoDir}-work-{分支名}`
}
