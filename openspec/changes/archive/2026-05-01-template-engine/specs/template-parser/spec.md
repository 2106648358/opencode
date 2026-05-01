## ADDED Requirements

### Requirement: Scan markdown files in template directory

The system SHALL recursively scan the template directory for all `.md` files.

#### Scenario: Directory scan returns template files
- **WHEN** template directory contains `explain.md`, `test.md`, and `notes.txt`
- **THEN** system SHALL return `explain.md` and `test.md`
- **THEN** system SHALL ignore `notes.txt`

### Requirement: Parse YAML frontmatter with gray-matter

The system SHALL use `gray-matter` to parse each `.md` file into metadata and body.

#### Scenario: Valid frontmatter
- **WHEN** a `.md` file contains valid YAML frontmatter
- **THEN** system SHALL return structured metadata (`data`) and markdown body (`content`)

#### Scenario: No frontmatter
- **WHEN** a `.md` file has no frontmatter
- **THEN** system SHALL use empty metadata and the entire file as body

#### Scenario: Invalid YAML
- **WHEN** frontmatter YAML is invalid
- **THEN** system SHALL attempt `fallbackSanitization` (matching existing pattern in config/markdown.ts)
- **THEN** if fallback also fails, SHALL skip the file and log warning

### Requirement: Extract required metadata fields

The system SHALL extract `name`, `description`, and `variables` from frontmatter.

#### Scenario: Complete metadata
- **WHEN** frontmatter contains `name`, `description`, and `variables`
- **THEN** system SHALL make all fields available to consumers

#### Scenario: Missing optional fields
- **WHEN** frontmatter has `name` but no `description` or `variables`
- **THEN** system SHALL use filename as fallback name
- **THEN** `description` SHALL default to empty string
- **THEN** `variables` SHALL default to empty array

### Requirement: Maintain in-memory template registry

The system SHALL maintain a reactive registry of all parsed templates, keyed by filename (without extension).

#### Scenario: Access template by key
- **WHEN** consumer requests template `explain-code`
- **THEN** system SHALL return `{ name, description, variables, body }` for `explain-code.md`

#### Scenario: Template not found
- **WHEN** consumer requests a non-existent template key
- **THEN** system SHALL return `undefined`
