## 1. Config schema

- [x] 1.1 Add `template.repos` to config schema (`src/config/config.ts`)

## 2. Template repository sync

- [x] 2.1 Implement `git clone --depth 1` on first use
- [x] 2.2 Implement `git pull --ff-only` on startup and manual refresh
- [x] 2.3 Implement `@parcel/watcher` subscription for file changes
- [x] 2.4 Implement polling fallback for watcher-unavailable environments

## 3. Template file scanning

- [x] 3.1 Implement recursive `.md` file scanner for template directory
- [x] 3.2 Implement in-memory template registry with reactive updates

## 4. Template parsing

- [x] 4.1 Implement gray-matter parser wrapper with fallback sanitization
- [x] 4.2 Extract metadata: name, description, variables from frontmatter

## 5. Variable substitution

- [x] 5.1 Implement `{{variable}}` placeholder replacement engine
- [x] 5.2 Implement variable validation (all declared variables must be filled)
