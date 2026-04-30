## Context

The CLI has two rendering paths for the brand logo, both sourced from glyph data in `src/cli/logo.ts`:

1. **TTY / interactive path** (`src/cli/cmd/tui/component/logo.tsx`): Solid.js component that renders the glyphs with per-character shimmer, burst, and glow effects using sub-pixel sampling. Each glyph cell can be `█` (solid block), `▀` (upper half block), `_` (full shadow), `^` (letter top, shadow bottom), `~` (shadow only), `,` (bottom half shadow rendered as `▄`), or ` ` (space).

2. **Non-TTY path** (`src/cli/ui.ts`): A plain-text `wordmark` array with the same visual shape, rendered directly via `process.stderr.write` (no ANSI processing).

The glyph data uses a split `left`/`right` format. Each side contains 4-row arrays of equal width. The TUI component concatenates `left[i] + " " + right[i]` to form the full row. The wordmark stores the already-concatenated full rows.

## Goals / Non-Goals

**Goals:**
- Replace the "opencode" visual logo with "EzCode" across all rendering paths
- Design new glyph data for "z" (the only character not present in the existing glyph set)
- Ensure the new logo is visually consistent with the existing block-letter style

**Non-Goals:**
- Not changing the `go` logo or marks constant (separate branding for GO upsell tier)
- No behavior, functionality, or architecture changes

## Decisions

- **Glyph width stays at 4 cells per character** — matches the existing convention and keeps the block-letter aesthetic consistent
- **Left/right split unchanged** — the 6-character "EzCode" logo splits as 3 left (E, z, C) + 3 right (o, d, e); row widths reduce from 19 to 14 cells per side
- **z character design**: Top row `█▀▀▀`, middle row `__▀▀`, bottom row `▀▀▀▀`. The two shadow cells followed by two upper-half blocks on the middle row create a diagonal from top-right to bottom-right, forming a readable Z within the 4-cell constraint
- **E, C, o, d, e** reuse existing glyph patterns from the current character set, unchanged

## Risks / Trade-offs

- [Low] The new wordmark row widths shrink from 39 to 29 characters. No existing code reads the wordmark length — it's purely display-only — so this has zero downstream impact.
