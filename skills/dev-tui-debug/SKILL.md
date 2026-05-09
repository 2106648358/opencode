---
name: dev-tui-debug
description: Use when developing OpenCode locally or debugging the TUI (SolidJS/opentui). Covers bun dev workflow, inspector debugging, server/TUI split debugging, VSCode attach config, and building standalone executables.
---

# Dev TUI Debug

## Overview
Local development and debugging workflow for OpenCode's TUI (`packages/opencode/src/cli/cmd/tui/`) and server. The TUI is built with SolidJS and [opentui](https://github.com/sst/opentui).

## Quick Start

```bash
bun install
bun dev                    # Run TUI in packages/opencode
bun dev <directory>        # Run against a different directory
bun dev .                  # Run in the opencode repo root itself
```

## bun dev vs opencode CLI

| Command | Development | Production |
|---------|-------------|------------|
| Help | `bun dev --help` | `opencode --help` |
| TUI | `bun dev <dir>` | `opencode <dir>` |
| API server | `bun dev serve` | `opencode serve` |
| Web UI | `bun dev web` | `opencode web` |

## Debugging the TUI

### Method 1: Inspector attach (recommended)

Run the TUI with `--inspect` and attach your debugger:

```bash
bun run --inspect=ws://localhost:6499/ --cwd packages/opencode --conditions=browser ./src/index.ts
```

Set `BUN_OPTIONS` to avoid typing the flag every time:

```bash
export BUN_OPTIONS=--inspect=ws://localhost:6499/
```

Use `--inspect-wait` or `--inspect-brk` to pause on start.

### Method 2: Server + TUI split debugging

When breakpoints in server code don't fire (because `bun dev` runs the server in a worker thread), debug them separately:

1. Start the server with inspector:
   ```bash
   bun run --inspect=ws://localhost:6499/ --cwd packages/opencode ./src/index.ts serve --port 4096
   ```

2. Attach the TUI to the running server:
   ```bash
   opencode attach http://localhost:4096
   ```

### Method 3: `bun dev spawn`

Run `bun dev spawn` instead of `bun dev` to run the server as a child process instead of a worker thread. This may resolve breakpoint issues in some setups.

### VSCode Setup

Copy `.vscode/launch.example.json` to `.vscode/launch.json` and `.vscode/settings.example.json` to `.vscode/settings.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "attach",
      "name": "opencode (attach)",
      "url": "ws://localhost:6499/"
    }
  ]
}
```

Requires the [Bun VSCode extension](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode) (`oven.bun-vscode`).

**Avoid** `"request": "launch"` configurations and the VSCode `JavaScript Debug Terminal` — breakpoints can be incorrectly mapped.

## Running Servers Independently

### API Server
```bash
bun dev serve                    # Port 4096
bun dev serve --port 8080        # Custom port
```

### Web App (for UI-only changes)
```bash
bun run --cwd packages/app dev   # Starts at http://localhost:5173
```

### Desktop App (Electron)
```bash
bun run --cwd packages/desktop dev      # Dev mode
bun run --cwd packages/desktop build    # Production build
bun run --cwd packages/desktop package  # Package for distribution
```

## Building a Standalone Executable

```bash
./packages/opencode/script/build.ts --single
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

## Regenerating SDK

After changes to API or SDK (`packages/opencode/src/server/server.ts`):

```bash
./script/generate.ts
```

## Project Structure

| Path | Purpose |
|------|---------|
| `packages/opencode` | Core business logic & server |
| `packages/opencode/src/cli/cmd/tui/` | TUI (SolidJS + opentui) |
| `packages/app` | Shared web UI components (SolidJS) |
| `packages/desktop` | Electron desktop app |
| `packages/plugin` | `@opencode-ai/plugin` SDK |
