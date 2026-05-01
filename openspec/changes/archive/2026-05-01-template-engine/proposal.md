## Why

团队需要通过 git 仓库分发和同步 prompt 模板，让成员能共享、版本化管理常用提示词。当前没有模板系统，用户只能手动复制粘贴。

## What Changes

- 新增配置字段 `template.repo`，指定模板 git 仓库 URL
- 实现首次 `git clone --depth 1` 到 `~/.opencode/templates/<name>/`
- 实现后续 `git pull` 同步（后台/启动时/手动）
- 扫描模板目录下的 `.md` 文件
- 使用 gray-matter 解析 YAML frontmatter + markdown body
- 实现 `{{variable}}` 模板变量替换引擎
- 支持多模板源（多个 repo 或多个目录）
- 支持 `@parcel/watcher` 监控模板文件变化

## Capabilities

### New Capabilities
- `template-repo-sync`: git clone/pull 模板仓库并保持同步
- `template-parser`: 扫描 .md 文件并用 gray-matter 解析 frontmatter
- `template-variables`: 模板变量声明与运行时替换

### Modified Capabilities

- (none)

## Impact

- `src/config/`: 新增 `template` 配置 schema
- `src/template/`: 新建模板引擎模块
- 新增依赖: `gray-matter` (已有), `@parcel/watcher` (已有)
- 文件系统: `~/.opencode/templates/` 目录
