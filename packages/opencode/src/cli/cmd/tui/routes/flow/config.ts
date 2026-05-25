export type PRDEntry = {
  id: string
  name: string
  title: string
  file: string
}

export type PRDContent = { f: Record<string, unknown>; b: Record<string, unknown> }

/** GitHub 仓库 API 返回类型 */
export type GitHubRepo = {
  id: number
  full_name: string
  name: string
}

export type FlowStep = {
  key: string
  label: string
  templateName: string
  skillContent: string
}

const SKILL_PRD_TECH_SOLUTION = `你是一名资深架构师，拥有丰富的前后端开发经验

## 任务
根据 f.json 和 b.json 生成一份技术方案文档，前端采用vue3+JS+element；后端采用java8 + springboot；
前端开发者将直接根据f.json 开发，后端开发者需要借助你的技术设计方案如er结构/接口/业务逻辑等进行开发

## 技术文档格式
- 技术文档
  - 前端完整f.json
  - 后端技术方案`

const SKILL_OPENSPEC_PROPOSE = `Propose a new change - create the change and generate all artifacts in one step.

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

When ready to implement, run /opsx-apply

---

**Input**: The user's request should include a change name (kebab-case) OR a description of what they want to build.

**Steps**

1. **If no clear input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" -> \`add-user-auth\`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Create the change directory**
   \`\`\`bash
   opencode openspec new change "<name>"
   \`\`\`
   This creates a scaffolded change at \`openspec/changes/<name>/\`.

3. **Get the artifact build order**
   \`\`\`bash
   opencode openspec status --change "<name>" --json
   \`\`\`
   Parse the JSON to get:
   - \`applyRequires\`: array of artifact IDs needed before implementation (e.g., \`["tasks"]\`)
   - \`artifacts\`: list of all artifacts with their status and dependencies

4. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is \`ready\` (dependencies satisfied)**:
      - Get instructions:
        \`\`\`bash
        opencode openspec instructions <artifact-id> --change "<name>" --json
        \`\`\`
      - The instructions JSON includes:
        - \`context\`: Project background (constraints for you - do NOT include in output)
        - \`rules\`: Artifact-specific rules (constraints for you - do NOT include in output)
        - \`template\`: The structure to use for your output file
        - \`instruction\`: Schema-specific guidance for this artifact type
        - \`outputPath\`: Where to write the artifact
        - \`dependencies\`: Completed artifacts to read for context
      - Read any completed dependency files for context
      - Create the artifact file using \`template\` as the structure
      - Apply \`context\` and \`rules\` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until all \`applyRequires\` artifacts are complete**
      - After creating each artifact, re-run \`opencode openspec status --change "<name>" --json\`
      - Check if every artifact ID in \`applyRequires\` has \`status: "done"\` in the artifacts array
      - Stop when all \`applyRequires\` artifacts are done

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify
      - Then continue with creation

5. **Show final status**
   \`\`\`bash
   opencode openspec status --change "<name>"
   \`\`\`

**Output**

After completing all artifacts, summarize:
- Change name and location
- List of artifacts created with brief descriptions
- What's ready: "All artifacts created! Ready for implementation."
- Prompt: "Run \`/opsx-apply\` to start implementing."

**Artifact Creation Guidelines**

- Follow the \`instruction\` field from \`opencode openspec instructions\` for each artifact type
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- Use \`template\` as the structure for your output file - fill in its sections
- **IMPORTANT**: \`context\` and \`rules\` are constraints for YOU, not content for the file
  - Do NOT copy \`<context>\`, \`<rules>\`, \`<project_context>\` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Guardrails**
- Create ALL artifacts needed for implementation (as defined by schema's \`apply.requires\`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer making reasonable decisions to keep momentum
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next`

const SKILL_OPENSPEC_APPLY_CHANGE = `Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run \`opencode openspec list --json\` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., \`/opsx-apply <other>\`).

2. **Check status to understand the schema**
   \`\`\`bash
   opencode openspec status --change "<name>" --json
   \`\`\`
   Parse the JSON to understand:
   - \`schemaName\`: The workflow being used (e.g., "spec-driven")
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

3. **Get apply instructions**

   \`\`\`bash
   opencode openspec instructions apply --change "<name>" --json
   \`\`\`

   This returns:
   - Context file paths (varies by schema - could be proposal/specs/design/tasks or spec/tests/implementation/docs)
   - Progress (total, complete, remaining)
   - Task list with status
   - Dynamic instruction based on current state

   **Handle states:**
   - If \`state: "blocked"\` (missing artifacts): show message, suggest using openspec-continue-change
   - If \`state: "all_done"\`: congratulate, suggest archive
   - Otherwise: proceed to implementation

4. **Read context files**

   Read the files listed in \`contextFiles\` from the apply instructions output.
   The files depend on the schema being used:
   - **spec-driven**: proposal, specs, design, tasks
   - Other schemas: follow the contextFiles from CLI output

5. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

6. **Implement tasks (loop until done or blocked)**

   For each pending task:
   - Show which task is being worked on
   - Make the code changes required
   - Keep changes minimal and focused
   - Mark task complete in the tasks file: \`- [ ]\` -> \`- [x]\`
   - Continue to next task

   **Pause if:**
   - Task is unclear -> ask for clarification
   - Implementation reveals a design issue -> suggest updating artifacts
   - Error or blocker encountered -> report and wait for guidance
   - User interrupts

7. **On completion or pause, show status**

   Display:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: suggest archive
   - If paused: explain why and wait for guidance

**Guardrails**
- Keep going through tasks until done or blocked
- Always read context files before starting (from the apply instructions output)
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Update task checkbox immediately after completing each task
- Pause on errors, blockers, or unclear requirements - don't guess
- Use contextFiles from CLI output, don't assume specific file names

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:
- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly`

const SKILL_GENERATE_FRONTEND_CODE = `根据技术方案文档中的
##前端完整 f.json
##接口设计
采用vue3+JS+element生成前端代码生成前端代码
##注意
组件有logicId，代表该组件需要在这个地方触发后端逻辑，但是前端应该提前实现ui效果`

const SKILL_OPENSPEC_ARCHIVE_CHANGE = `Archive a completed change.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run \`opencode openspec list --json\` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show only active changes (not already archived).
   Include the schema used for each change if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check artifact completion status**

   Run \`opencode openspec status --change "<name>" --json\` to check artifact completion.

   **If any artifacts are not \`done\`:**
   - Display warning listing incomplete artifacts
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

3. **Check task completion status**

   Read the tasks file (typically \`tasks.md\`) to check for incomplete tasks.
   Count tasks marked with \`- [ ]\` (incomplete) vs \`- [x]\` (complete).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

4. **Assess delta spec sync state**

   Check for delta specs at \`openspec/changes/<name>/specs/\`. If none exist, proceed without sync prompt.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at \`openspec/specs/<capability>/spec.md\`
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Show a combined summary before prompting
   - Prompt: "Sync now (recommended)", "Archive without syncing"
   - If user chooses sync, use openspec-sync-specs skill

5. **Perform the archive**

   \`\`\`bash
   opencode openspec archive "<name>"
   \`\`\`

6. **Display summary**

   Show archive completion summary including:
   - Change name, Schema used, Archive location
   - Note about any warnings (incomplete artifacts/tasks)

**Guardrails**
- Always prompt for change selection if not provided
- Use \`opencode openspec status --json\` for completion checking
- Don't block archive on warnings - just inform and confirm
- Show clear summary of what happened`

export const MOCK_PRDS: PRDEntry[] = [
  { id: "1", name: "PRD-001", title: "客户公海-高级筛选", file: "prds/PRD-001" },
  { id: "2", name: "PRD-002", title: "用户中心V2", file: "prds/PRD-002" },
  { id: "3", name: "PRD-003", title: "订单管理优化", file: "prds/PRD-003" },
  { id: "4", name: "PRD-004", title: "支付网关升级", file: "prds/PRD-004" },
  { id: "5", name: "PRD-005", title: "数据中台建设", file: "prds/PRD-005" },
]

const PRD_LOADERS: Record<string, () => Promise<{ default: PRDContent }>> = {
  "1": () => import("./prds/PRD-001/index"),
  "2": () => import("./prds/PRD-002/index"),
  "3": () => import("./prds/PRD-003/index"),
  "4": () => import("./prds/PRD-004/index"),
  "5": () => import("./prds/PRD-005/index"),
}

export async function loadPRDContent(id: string): Promise<PRDContent | undefined> {
  const loader = PRD_LOADERS[id]
  if (!loader) return undefined
  const mod = await loader()
  return mod.default
}

function getGitHubToken() {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? ""
}

export const GITHUB_CONFIG = {
  baseUrl: "https://api.github.com",
  get token() { return getGitHubToken() },
  apiPath: "/user/repos",
  params: "per_page=100&sort=updated&type=all",
}

export const FLOW_STEPS: FlowStep[] = [
  { key: "step1", label: "获取技术方案", templateName: "flow-step1", skillContent: SKILL_PRD_TECH_SOLUTION },
  { key: "step2", label: "生成前端代码", templateName: "flow-step2", skillContent: SKILL_GENERATE_FRONTEND_CODE },
  { key: "step3", label: "前端：一次性创建所有 OpenSpec 工件", templateName: "flow-step3", skillContent: SKILL_OPENSPEC_PROPOSE },
  { key: "step4", label: "后端：一次性创建所有 OpenSpec 工件", templateName: "flow-step4", skillContent: SKILL_OPENSPEC_PROPOSE },
  { key: "step5", label: "根据 OpenSpec 工件生成代码", templateName: "flow-step5", skillContent: SKILL_OPENSPEC_APPLY_CHANGE },
  { key: "step6", label: "归档已完成变更", templateName: "flow-step6", skillContent: SKILL_OPENSPEC_ARCHIVE_CHANGE }
]

export function buildCreateBranchPrompt(repoPath: string, prdTitle?: string) {
  const repoDir = repoPath.split("/").pop() ?? repoPath
  const tokenUrl = `https://${GITHUB_CONFIG.token}@github.com/${repoPath}.git`
  const prdContext = prdTitle ? `PRD: ${prdTitle}\n` : ""
  return `## 任务
为 GitHub 仓库 ${repoPath} 创建工作树，基于 dev 创建特性分支并设置为当前工作区。

${prdContext}## 要求
1. 使用 git clone ${tokenUrl} 克隆到 ./${repoDir}（如本地已有则 pull 更新）
2. 使用 git worktree add 创建一个新的工作树，分支名按以下规则自动生成：flow/{PRD特点}-{仓库简称}-{MMDD}
3. 新分支基于 dev 分支创建
4. 将工作树目录设置为当前工作区

## 说明
- 使用 git worktree 而非直接 clone，以便后续针对同一仓库的多个特性并行开发
- 工作树目录命名建议：./${repoDir}-work-{分支名}`
}
