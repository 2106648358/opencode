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
