import { Glob } from "@opencode-ai/core/util/glob"

const FOLDERS = new Set([
  "node_modules",
  "bower_components",
  ".pnpm-store",
  "vendor",
  ".npm",
  "dist",
  "build",
  "out",
  ".next",
  "target",
  "bin",
  "obj",
  ".git",
  ".svn",
  ".hg",
  ".vscode",
  ".idea",
  ".turbo",
  ".output",
  "desktop",
  ".sst",
  ".cache",
  ".webkit-cache",
  "__pycache__",
  ".pytest_cache",
  "mypy_cache",
  ".history",
  ".gradle",
])

const FILES = [
  "**/*.swp",
  "**/*.swo",

  "**/*.pyc",

  // OS
  "**/.DS_Store",
  "**/Thumbs.db",

  // Logs & temp
  "**/logs/**",
  "**/tmp/**",
  "**/temp/**",
  "**/*.log",

  // Coverage/test outputs
  "**/coverage/**",
  "**/.nyc_output/**",
]

export const PATTERNS = [...FILES, ...FOLDERS]

/**
 * 判断文件是否应被忽略（匹配忽略规则）。
 *
 * 白名单优先级最高 — 文件命中白名单则直接放行。
 * 其次检查路径中是否含忽略文件夹名（如 node_modules）。
 * 最后检查文件名/路径是否匹配忽略文件模式（如 *.log）。
 */
export function match(
  filepath: string,
  opts?: {
    extra?: string[]
    whitelist?: string[]
  },
) {
  // 白名单匹配：命中则放行（忽略白名单）
  for (const pattern of opts?.whitelist || []) {
    if (Glob.match(pattern, filepath)) return false
  }

  // 检查路径中是否包含忽略文件夹（如 node_modules/.git 等）
  const parts = filepath.split(/[/\\]/)
  for (let i = 0; i < parts.length; i++) {
    if (FOLDERS.has(parts[i])) return true
  }

  // 检查文件名/路径是否匹配忽略文件模式
  const extra = opts?.extra || []
  for (const pattern of [...FILES, ...extra]) {
    if (Glob.match(pattern, filepath)) return true
  }

  return false
}

export * as FileIgnore from "./ignore"
