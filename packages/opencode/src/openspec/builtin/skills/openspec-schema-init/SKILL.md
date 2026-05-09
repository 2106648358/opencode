---
name: openspec-schema-init
description: Interactive wizard to create a custom OpenSpec schema with auto-generated slash commands. Use when the user wants to define their own workflow (e.g., TDD, code-review, release).
license: MIT
compatibility: Built into OpenCode.
metadata:
  author: opencode
  version: "1.0"
---

Guide the user to create a custom OpenSpec schema interactively, then automatically generate the corresponding skill files so the new workflow appears as `/` commands.

**This is an interactive wizard - do NOT create anything until you understand what the user wants.**

---

## Phase 1: Gather Requirements

Ask the user questions **one at a time**:

1. **Schema name** (kebab-case, e.g., `tdd-driven`, `code-review`)
   - If the user just says a description, convert to kebab-case

2. **Schema description** (one sentence about the workflow)

3. **Artifacts** - Ask: "What artifacts should this workflow create? List them in order of creation."
   - Each artifact is one document with an ID and description
   - Example: `spec → tests → implementation → docs`
   - Provide common presets they can pick from:
     - **(A) TDD**: spec → tests → implementation
     - **(B) Code Review**: checklist → review → approval
     - **(C) Release**: changelog → migration → deployment
     - **(D) Custom**: let them specify

4. After gathering, summarize and confirm before proceeding:
   ```
   ## Schema Summary
   - Name: <name>
   - Description: <desc>
   - Artifacts: <id1> → <id2> → ...
   - Command will be: /<name>

   Create this? (y/n)
   ```

---

## Phase 2: Create the Schema

Once confirmed:

1. Run the schema init command:
   ```bash
   opencode openspec schema init "<name>" --description "<desc>" --artifacts "<artifacts-comma-separated>"
   ```

2. Read the generated schema.yaml to understand the artifact structure:
   ```bash
   cat .openspec/schemas/<name>/schema.yaml
   ```

---

## Phase 3: Generate the Slash Commands

Create TWO files so the workflow appears in `/` autocomplete AND the AI can use it as a skill:

### File 1: Command file (for `/` autocomplete)

Create `.opencode/commands/<name>.md`:

```markdown
---
description: <schema description>
---

Create a change using the <name> workflow.

## Steps

1. **If no change name provided**, ask the user what they want to build.
   Derive a kebab-case name from their description.

2. **Create the change** using this custom schema:
   ```bash
   opencode openspec new change "<change-name>" --schema <name>
   ```

3. **Check status** to see which artifacts are ready:
   ```bash
   opencode openspec status --change "<change-name>" --json
   ```

4. **Create each artifact in sequence** until all are done:
   For each artifact with status "ready":
   - Get instructions:
     ```bash
     opencode openspec instructions <artifact-id> --change "<change-name>" --json
     ```
   - Read dependencies for context
   - Create the artifact file using the template
   - Show progress

5. **When all artifacts are complete**, tell the user:
   "All artifacts created for `<change-name>`. Ready to implement!"
```

### File 2: Skill file (for AI `skill` tool)

Create `.opencode/skills/<name>/SKILL.md` with the same content, but add proper YAML frontmatter:

```markdown
---
name: <name>
description: <schema description>
license: MIT
compatibility: Built into OpenCode.
metadata:
  author: opencode
  version: "1.0"
---
<same content as command file>
```

---

## Phase 4: Report & Verify

Show the user what was created:

```
## Schema Created: <name>

**Files created:**
- .openspec/schemas/<name>/schema.yaml (workflow definition)
- .openspec/schemas/<name>/templates/ (artifact templates)
- .opencode/commands/<name>.md (slash command)
- .opencode/skills/<name>/SKILL.md (AI skill)

**Try it now:**
- Type `/<name>` and select from autocomplete
- Or: `/<name> add-user-login` to create a change

**All artifacts in order:**
<artifact1> → <artifact2> → ...
```

---

## Guardrails

- Always confirm with the user BEFORE creating anything
- Validate schema name is kebab-case
- Create BOTH the command file AND the skill file
- Customize the command file's steps based on the actual artifact list
- Mention that the user can edit the generated `.opencode/schemas/<name>/schema.yaml` to adjust the workflow later
