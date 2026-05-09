---
name: openspec-verify-change
description: Verify implementation matches change artifacts. Use when the user wants to validate that implementation is complete, correct, and coherent before archiving.
license: MIT
compatibility: Built into OpenCode.
metadata:
  author: opencode
  version: "1.0"
---

Verify implementation matches change artifacts.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `opencode openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

2. **Read context**

   Run `opencode openspec status --change "<name>" --json` and `opencode openspec instructions apply --change "<name>" --json`.

   Read all context files: proposal, specs, design, tasks.

3. **Verify across three dimensions**

   **Completeness**: Check every task is done and every requirement/scenario has a corresponding implementation. Search the codebase using grep/glob to find implementation code.

   **Correctness**: Verify implementation matches the spec's requirements and scenarios. Does each scenario's WHEN/THEN behavior exist in the code?

   **Coherence**: Check for consistency across artifacts. Does the design match the implementation? Are there any contradictions?

4. **Issue classification**

   - **CRITICAL**: Missing implementation, security issues, breaking changes not documented
   - **WARNING**: Partial implementation, minor inconsistencies
   - **SUGGESTION**: Improvements, refactoring opportunities, documentation gaps

5. **Report findings**

   Present a verification report organized by dimension with issues categorized by severity. Include file references (e.g., `src/auth/login.ts:42`).

**Guardrails**
- Search the codebase thoroughly - don't just read the spec files
- Cross-reference implementation with each requirement
- Be specific about what's missing or incorrect
- Don't flag issues that are clearly out of scope
