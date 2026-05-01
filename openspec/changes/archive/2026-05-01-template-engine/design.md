## Context

当前没有模板管理能力。团队需要通过 git 分发 prompt 模板，但模板文件可能很多（几十到上百），需要高效地扫描、解析和按需加载。代码库中已有 gray-matter 用于 YAML frontmatter 解析，有 @parcel/watcher 用于文件监控。

## Goals / Non-Goals

**Goals:**
- 支持配置一个或多个模板 git 仓库 URL
- 首次使用时 shallow clone 到 `~/.opencode/templates/<name>/`
- 后续通过 git pull 增量同步（后台/手动/启动时）
- 扫描目录下所有 `.md` 文件，用 gray-matter 解析 frontmatter
- 提取模板元数据（name, description, variables）和 body
- 实现 `{{variable}}` 占位符替换引擎
- 支持 `@parcel/watcher` 监听文件变化并刷新内存缓存

**Non-Goals:**
- 不在 TUI 中直接编辑/创建模板文件（推荐在仓库中编辑后 git push）
- 不实现模板版本对比或冲突解决
- 不处理二进制模板文件

## Decisions

| 决策 | 选择 | 替代方案 |
|------|------|----------|
| clone 策略 | `--depth 1` shallow clone | full clone（模板仓库通常很小，但 shallow 更快） |
| 同步时机 | 启动时后台 pull + 侧边栏手动刷新按钮 + 可选定时 | 仅启动时 pull（模板变化可能滞后） |
| 存储位置 | `~/.opencode/templates/<repo-shortname>/` | 项目 `.opencode/` 内（模板独立于项目配置） |
| 多仓库 | 支持多个 repo，config 中 `template.repos` 为数组 | 单个 repo（不够灵活） |
| 配置格式 | `template.repos: [{ url, ref }]` | 仅 URL 字符串（扩展性差） |
| 内存模型 | 启动时全量扫描到内存 Map，watcher 增量更新 | 每次请求读磁盘（IO 太大） |

## Risks / Trade-offs

- [git pull 可能冲突] → shallow clone 且仅做 pull --ff-only，冲突时静默跳过并提示用户
- [模板仓库很大] → `--depth 1` 限制历史，后续可通过 git partial clone 进一步优化
- [watcher 在 Windows 上不稳定] → fallback 到定时轮询（每 60s check git 或扫描文件 mtime）
