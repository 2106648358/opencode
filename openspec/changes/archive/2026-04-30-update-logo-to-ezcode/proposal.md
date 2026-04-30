## Why

The current TUI and CLI logo displays "opencode" as the brand name. The project has been renamed to "EzCode" and the logo needs to be updated to reflect the new name.

## What Changes

- Replace the "opencode" glyph data in `src/cli/logo.ts` with new "EzCode" glyphs
- Update the `wordmark` plain-text array in `src/cli/ui.ts` to display "EzCode"
- The existing `go` logo and `marks` constant remain unchanged

## Capabilities

### New Capabilities

*(none — this is a visual rebranding, not a new capability)*

### Modified Capabilities

*(none — no spec-level behavior changes)*

## Impact

- `packages/opencode/src/cli/logo.ts` — glyph data for the logo
- `packages/opencode/src/cli/ui.ts` — plain-text wordmark for non-TTY CLI output
- All TUI pages (home.tsx, dialog-go-upsell.tsx) and CLI commands (index.ts, web.ts, upgrade.ts, uninstall.ts) reference these files indirectly and will reflect the new logo automatically
