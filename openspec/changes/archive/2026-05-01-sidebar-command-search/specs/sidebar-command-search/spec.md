## ADDED Requirements

### Requirement: Search input in sidebar

The sidebar SHALL display a search input field at the top of the content area, styled consistently with the DialogSelect input.

#### Scenario: Search input visible
- **WHEN** sidebar is visible
- **THEN** search input SHALL be displayed at top of sidebar content area

#### Scenario: Input focus on click
- **WHEN** user clicks on the search input
- **THEN** input SHALL receive focus and show cursor

#### Scenario: Input clears on Esc
- **WHEN** user presses Esc while input has text
- **THEN** input SHALL clear
- **WHEN** user presses Esc again on empty input
- **THEN** sidebar SHALL return to normal content display

### Requirement: Search commands via fuzzysort

The system SHALL search over `useCommandDialog().visibleOptions()` using fuzzysort, with title matches weighted 2x and category matches weighted 1x.

#### Scenario: Fuzzy match by title
- **WHEN** user types "mod"
- **THEN** results SHALL include `/models`, `/agents` (via title score)
- **THEN** results SHALL be sorted by fuzzysort score descending

#### Scenario: No results
- **WHEN** user types text that matches no commands
- **THEN** sidebar SHALL display "No results found"

### Requirement: Display results grouped by category

Search results SHALL be grouped by `category`, with category headers displayed above each group, matching DialogSelect's layout.

#### Scenario: Results with multiple categories
- **WHEN** search matches commands from "Session" and "Templates" categories
- **THEN** each category SHALL have a header label
- **THEN** commands SHALL be listed under their respective category

#### Scenario: Typing flattens categories
- **WHEN** user types in search input (non-empty)
- **THEN** categories SHALL still be shown (matching DialogSelect behavior when filter is active)

### Requirement: Execute command on click

Clicking a search result SHALL execute the corresponding command via `command.trigger(value)`.

#### Scenario: Click to execute
- **WHEN** user clicks a search result
- **THEN** `command.trigger(result.value)` SHALL be called
- **THEN** search input SHALL clear
- **THEN** sidebar SHALL return to normal content display

### Requirement: Restore sidebar content on clear

When the search input is empty, the sidebar SHALL show its normal content (Templates section + MCP + Files + etc.).

#### Scenario: Clear restores content
- **WHEN** user clears search input (backspace or Esc)
- **THEN** sidebar content SHALL return to normal grouped sections
