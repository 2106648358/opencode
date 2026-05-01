## ADDED Requirements

### Requirement: Configure template git repository

The system SHALL support configuring one or more template git repository URLs via `opencode.jsonc` under `template.repos` as an array of `{ url, ref? }` objects.

#### Scenario: Single repo configuration
- **WHEN** user sets `template.repos` to `[{ "url": "git@github.com:team/templates.git" }]`
- **THEN** the system SHALL clone the repo to `~/.opencode/templates/default/`

#### Scenario: Multiple repos
- **WHEN** user sets `template.repos` to multiple entries
- **THEN** each repo SHALL be cloned to `~/.opencode/templates/<shortname>/` derived from the URL

### Requirement: Clone template repository on first use

The system SHALL perform `git clone --depth 1 <url>` when a configured repo does not exist locally.

#### Scenario: Successful first clone
- **WHEN** template repo URL is configured and local directory does not exist
- **THEN** system SHALL clone with `--depth 1` and report success

#### Scenario: Clone failure
- **WHEN** git clone fails (network/auth error)
- **THEN** system SHALL log the error and not retry automatically
- **THEN** side panel SHALL show sync error status

### Requirement: Sync template repository

The system SHALL support syncing templates via `git pull --ff-only` on startup and on manual refresh.

#### Scenario: Startup sync
- **WHEN** TUI starts and template repos exist locally
- **THEN** system SHALL run `git pull --ff-only` in background for each repo

#### Scenario: Manual refresh
- **WHEN** user clicks sync button in sidebar
- **THEN** system SHALL run `git pull --ff-only` and update template list

#### Scenario: Sync conflict
- **WHEN** git pull fails with divergence
- **THEN** system SHALL skip update and show stale status indicator

### Requirement: Watch template file changes

The system SHALL use `@parcel/watcher` to monitor template directory for file additions, changes, and deletions.

#### Scenario: New template added
- **WHEN** a new `.md` file appears in the template directory
- **THEN** system SHALL parse it and add to in-memory template registry

#### Scenario: Template deleted
- **WHEN** a `.md` file is removed from template directory
- **THEN** system SHALL remove it from in-memory template registry

#### Scenario: Watcher unavailable
- **WHEN** `@parcel/watcher` fails to initialize (e.g., on some Windows configurations)
- **THEN** system SHALL fall back to periodic polling every 60 seconds
