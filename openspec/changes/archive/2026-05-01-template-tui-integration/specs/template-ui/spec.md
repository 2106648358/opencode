## ADDED Requirements

### Requirement: Register templates as commands

Each parsed template SHALL be registered as a `CommandOption` with `category: "Templates"`, `slash: { name }`, and `onSelect` handler.

#### Scenario: Template appears in command palette
- **WHEN** template `explain-code.md` is parsed
- **THEN** a CommandOption SHALL be registered with `value: "template:explain-code"`, `title: "解释代码"`, `category: "Templates"`, `slash: { name: "explain" }`

#### Scenario: Template appears in slash autocomplete
- **WHEN** user types `/exp` in prompt
- **THEN** `/explain` SHALL appear in autocomplete results

#### Scenario: Template commands unregister on file change
- **WHEN** template file is deleted or renamed
- **THEN** corresponding CommandOption SHALL be unregistered

### Requirement: Variable fill dialog

Clicking a template with declared variables SHALL open a modal dialog listing each variable with an input field.

#### Scenario: Dialog shows variables
- **WHEN** user clicks a template with `variables: [{ name: "file" }, { name: "language" }]`
- **THEN** dialog SHALL display two input fields labeled "file" and "language"
- **THEN** each input SHALL use the variable's `description` as placeholder

#### Scenario: Dialog for variable-less template
- **WHEN** user clicks a template with no variables
- **THEN** system SHALL skip the dialog and insert body directly

#### Scenario: Cancel dialog
- **WHEN** user clicks cancel in variable dialog
- **THEN** dialog SHALL close without inserting anything
- **THEN** sidebar SHALL remain in current state

#### Scenario: Fill and confirm
- **WHEN** user fills all variables and clicks confirm
- **THEN** system SHALL replace `{{variable}}` placeholders with provided values
- **THEN** result SHALL be inserted into prompt

### Requirement: Insert filled template into prompt

After variable substitution, the system SHALL emit `TuiEvent.PromptAppend` to insert the result into the prompt input area at the cursor position.

#### Scenario: Insert at cursor
- **WHEN** template body is substituted and confirmed
- **THEN** `TuiEvent.PromptAppend` SHALL be emitted with the final text
- **THEN** prompt input SHALL display the inserted text at cursor position

### Requirement: Templates section in sidebar

The sidebar SHALL display a collapsible "Templates" section listing all registered templates.

#### Scenario: Templates section visible
- **WHEN** sidebar is visible and templates are registered
- **THEN** a "Templates" section SHALL appear in sidebar_content
- **THEN** each template SHALL show as a clickable item with name and description

#### Scenario: Click template from section
- **WHEN** user clicks a template item in the sidebar Templates section
- **THEN** if template has variables, dialog SHALL open
- **THEN** if template has no variables, insert body directly
