## ADDED Requirements

### Requirement: Declare template variables in frontmatter

Templates SHALL declare variables in frontmatter as an array of `{ name, description }` objects.

#### Scenario: Variables declared
- **WHEN** frontmatter contains `variables: [{ name: "file", description: "Code file path" }]`
- **THEN** system SHALL recognize `file` as a variable with description

#### Scenario: No variables
- **WHEN** frontmatter has no `variables` field or empty array
- **THEN** system SHALL treat template as having no variables (no substitution needed)

### Requirement: Replace variables in template body

The system SHALL replace `{{variable_name}}` placeholders in the template body with provided values.

#### Scenario: Single variable replacement
- **WHEN** template body contains `Explain {{language}} code` and `language = "TypeScript"`
- **THEN** result SHALL be `Explain TypeScript code`

#### Scenario: Multiple variable replacement
- **WHEN** template body contains `{{file}}` and `{{language}}` and both values provided
- **THEN** system SHALL replace all occurrences

#### Scenario: Unknown variable in body
- **WHEN** body contains `{{undefined_var}}` and no value is provided
- **THEN** system SHALL leave `{{undefined_var}}` as-is (not crash)

### Requirement: Validate required variables

The system SHALL validate that all declared variables have been provided before substitution.

#### Scenario: All variables filled
- **WHEN** all declared variables have non-empty values
- **THEN** system SHALL proceed with substitution

#### Scenario: Missing variable value
- **WHEN** a declared variable has no value
- **THEN** system SHALL return an error indicating which variable is missing
