---
name: openspec-bulk-archive-change
description: Archive multiple completed changes at once. Use when archiving several parallel changes.
license: MIT
compatibility: Built into OpenCode.
metadata:
  author: opencode
  version: "1.0"
---

Archive multiple completed changes at once.

**Input**: Optionally specify change names. If omitted, prompt for selection.

**Steps**

1. **Get available changes**

   Run `opencode openspec list --json` to get all active changes.

2. **Select changes to archive**

   Present changes with their status. Use the **AskUserQuestion tool** to let the user select multiple changes.

3. **Detect spec conflicts**

   For each selected change, check if it has delta specs. If two or more changes modify the same capability, flag as a potential conflict.

4. **Resolve conflicts**

   For conflicting changes:
   - Read the codebase to determine which version is current
   - Automatically resolve if one version clearly matches codebase
   - Ask user if ambiguous

5. **Archive each change**

   For each change:
   ```bash
   opencode openspec archive "<name>"
   ```

6. **Show summary**

   List all archived changes and their archive locations. Note any conflicts resolved.

**Guardrails**
- Process changes one at a time
- Always detect and flag spec conflicts before archiving
- Preserve data - never delete without confirmation
