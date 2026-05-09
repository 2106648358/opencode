---
name: openspec-archive-change
description: Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete.
license: MIT
compatibility: Built into OpenCode.
metadata:
  author: opencode
  version: "1.0"
---

Archive a completed change.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `opencode openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show only active changes (not already archived).
   Include the schema used for each change if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check artifact completion status**

   Run `opencode openspec status --change "<name>" --json` to check artifact completion.

   **If any artifacts are not `done`:**
   - Display warning listing incomplete artifacts
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

3. **Check task completion status**

   Read the tasks file (typically `tasks.md`) to check for incomplete tasks.
   Count tasks marked with `- [ ]` (incomplete) vs `- [x]` (complete).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

4. **Assess delta spec sync state**

   Check for delta specs at `openspec/changes/<name>/specs/`. If none exist, proceed without sync prompt.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at `openspec/specs/<capability>/spec.md`
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Show a combined summary before prompting
   - Prompt: "Sync now (recommended)", "Archive without syncing"
   - If user chooses sync, use openspec-sync-specs skill

5. **Perform the archive**

   ```bash
   opencode openspec archive "<name>"
   ```

6. **Display summary**

   Show archive completion summary including:
   - Change name, Schema used, Archive location
   - Note about any warnings (incomplete artifacts/tasks)

**Guardrails**
- Always prompt for change selection if not provided
- Use `opencode openspec status --json` for completion checking
- Don't block archive on warnings - just inform and confirm
- Show clear summary of what happened
