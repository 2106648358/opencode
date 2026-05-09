---
name: openspec-onboard
description: Guided onboarding for OpenSpec - walk through a complete workflow cycle with narration and real codebase work.
license: MIT
compatibility: Built into OpenCode.
metadata:
  author: opencode
  version: "1.0"
---

Guide the user through their first complete OpenSpec workflow cycle. This is a teaching experience—you'll do real work in their codebase while explaining each step.

---

## Phase 1: Welcome

Display a welcome message explaining the workflow cycle:
1. Pick a small, real task in the codebase
2. Explore the problem briefly
3. Create a change (the container for work)
4. Build the artifacts: proposal → specs → design → tasks
5. Implement the tasks
6. Archive the completed change

## Phase 2: Task Selection

Scan the codebase for small improvement opportunities:
- TODO/FIXME comments
- Missing error handling
- Functions without tests
- Type issues (`any` types)
- Debug artifacts

Present 3-4 specific suggestions. If nothing found, ask the user what they'd like to work on.

## Phase 3: Explore Demo

Investigate the relevant code (1-2 minutes), draw ASCII diagrams if helpful, note considerations.

## Phase 4: Create the Change

```bash
opencode openspec new change "<name>"
```

## Phase 5-8: Build Artifacts

Work through each artifact (proposal → specs → design → tasks), showing the user what's being created and why. Follow the standard OpenSpec workflow.

## Phase 9: Apply (Implementation)

Implement each task, checking them off as done. Reference specs/design naturally.

## Phase 10: Archive

```bash
opencode openspec archive "<name>"
```

## Phase 11: Recap

Summarize what was learned and point to next steps:
- `/opsx-propose` to start a new change
- `/opsx-apply` to implement
- `/opsx-archive` to archive

**Guardrails**
- Follow EXPLAIN → DO → SHOW → PAUSE pattern at key transitions
- Keep narration light during implementation
- Don't skip phases even for small changes
- Pause for acknowledgment at marked points
- Handle exits gracefully
- Use real codebase tasks - don't simulate
