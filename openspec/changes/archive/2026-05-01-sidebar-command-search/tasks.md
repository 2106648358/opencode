## 1. Search input in sidebar

- [x] 1.1 Add search input component to sidebar (above sidebar_content slot)
- [x] 1.2 Wire input to command data source (`useCommandDialog().visibleOptions()`)
- [x] 1.3 Implement fuzzysort filtering with title/category scoring
- [x] 1.4 Implement category-grouped result display (matching DialogSelect layout)

## 2. Search interaction

- [x] 2.1 Implement two-state behavior: empty→sidebar content, typing→search results
- [x] 2.2 Implement click-to-execute (command.trigger on result click)
- [x] 2.3 Implement Esc/clear to restore sidebar content
- [x] 2.4 Handle edge cases: no results, all results filtered out
