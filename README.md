# Claude Ralph

![Ralph](ralph.webp)

> 基于 [snarktank/ralph](https://github.com/snarktank/ralph) 的中文优化版本，感谢原作者 [Ryan Carson](https://x.com/ryancarson) 和 [Geoffrey Huntley 的 Ralph 模式](https://ghuntley.com/ralph/)。

Ralph 是一个自主 AI agent 循环系统，为 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 提供全局安装的管理工具和可视化 Web 控制台。它重复运行 Claude Code 直到所有 PRD 条目完成，每次迭代都是全新实例，记忆通过 git 历史、`progress.txt` 和 `prd.json` 持久化。

## 特性

- **一键安装** — `npm install -g claude-ralph && ralph init`
- **交互式引导** — 权限确认、环境检测、Git Bash 路径、飞书 Webhook、运行参数
- **Web 控制台** — 需求看板、自动化任务启停、终端、日志、归档、设置
- **多项目管理** — 侧边栏下拉切换，CLI 和 Web 均可添加项目
- **API 容错** — 超时保护、输出有效性检查、自动重试、飞书通知
- **全中文** — PRD、进度报告、验收标准、CLI 提示全部中文
- **Claude Code 插件** — `/prd` 生成需求文档、`/ralph` 转换为任务格式

## 快速开始

### 安装

```bash
npm install -g claude-ralph
```

### 初始化

```bash
ralph init
```

交互式引导会帮你完成：
1. 权限声明与确认
2. 环境检测（Node.js、Claude CLI）
3. Windows Git Bash 路径配置
4. 飞书 Webhook 通知（可选）
5. 默认运行参数
6. 首个项目配置
7. Claude Code 插件安装引导

### 启动 Web 控制台

```bash
ralph dashboard
```

自动打开浏览器访问 `http://localhost:3000`，提供：
- 需求任务看板（拖拽管理）
- 启动/停止 Ralph 自动化循环
- 实时终端和日志
- 归档历史查看
- 在线配置管理

### Claude Code 插件

安装 `claude-ralph` 后，Skills 随 npm 包一同分发。运行 `ralph init` 时会自动尝试注册到 Claude Code。

如果自动注册失败，可手动安装：
```bash
claude install "$(npm root -g)/claude-ralph/.claude-plugin"
```

可用的 skill：
- `/prd` — 生成产品需求文档（含头脑风暴和需求讨论）
- `/ralph` — 将 PRD 转换为 prd.json 任务格式

### 更新

```bash
npm update -g claude-ralph
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `ralph init` | 交互式初始化引导 |
| `ralph dashboard` | 启动 Web 控制台 |
| `ralph dashboard --no-open` | 启动但不自动打开浏览器 |
| `ralph add-project` | 交互式添加项目 |
| `ralph config <key> <value>` | 修改配置 |
| `ralph --version` | 查看版本 |

**注意：** `ralph` 是管理工具，不是 AI 对话工具。与 AI 的所有对话在 Claude Code 中进行。

## 工作流程

### 1. 创建 PRD

在 Claude Code 中：

```
加载 prd skill，为 [你的功能描述] 创建 PRD
```

流程会自动经历：
1. **头脑风暴** — 调用 brainstorming skill 进行创意发散
2. **交互式澄清** — 通过可选择的问题收集关键信息
3. **需求讨论** — 深入确认细节、边界情况、技术影响
4. **生成 PRD** — 输出到 `tasks/prd-[feature-name].md`

### 2. 转换为 Ralph 格式

```
加载 ralph skill，将 tasks/prd-[feature-name].md 转换为 prd.json
```

### 3. 运行 Ralph

通过 Web 控制台点击启动，或直接命令行：

```bash
./scripts/ralph/ralph.sh --tool claude --timeout 30 --webhook <飞书URL> 10
```

Ralph 会循环执行：
1. 创建功能分支
2. 选择优先级最高的未完成用户故事
3. 实现该故事并运行质量检查
4. 提交代码，标记故事为 `passes: true`
5. 将经验追加到 `progress.txt`
6. 重复直到所有故事完成

## 项目结构

```
claude-ralph/
├── src/                      # CLI 源码（TypeScript）
│   ├── bin/ralph.ts           # CLI 入口
│   ├── commands/              # 子命令（init, start, stop, config, add-project）
│   └── lib/global-config.ts   # 全局配置读写
├── dashboard/                 # Web 控制台（Next.js 16）
│   ├── server/ws.ts           # WebSocket 实时更新
│   └── src/
│       ├── app/               # 6 个页面 + 14 个 API 路由
│       ├── components/        # 业务组件 + shadcn/ui
│       └── lib/               # 配置、状态、类型
├── scripts/ralph/             # 核心脚本
│   ├── ralph.sh               # 主循环（含 API 容错）
│   └── CLAUDE.md              # Claude Code 实例指令
├── skills/                    # Claude Code 插件技能
│   ├── prd/SKILL.md           # PRD 生成
│   └── ralph/SKILL.md         # PRD 转 JSON
├── flowchart/                 # 流程图可视化（Vite）
└── .claude-plugin/            # Claude Code Marketplace 配置
```

## 配置

所有配置统一存储在 `~/.ralph/config.json`，CLI 和 Web 控制台共享：

```json
{
  "defaultTool": "claude",
  "defaultMaxIterations": 10,
  "timeoutMinutes": 30,
  "maxConsecutiveFailures": 5,
  "retryIntervalSeconds": 3600,
  "webhookUrl": "",
  "gitBashPath": "",
  "port": 3000,
  "wsPort": 3001,
  "terminalFontSize": 14,
  "autoOpenBrowser": true,
  "activeProject": "",
  "projects": []
}
```

Web 控制台设置页可在线修改所有配置，包括飞书 Webhook 测试、超时参数、环境配置等。

## API 容错机制

ralph.sh 内置以下容错能力：

- **超时保护** — 单次迭代超时自动终止（默认 30 分钟）
- **输出有效性检查** — 检测 API 错误标识（rate limit、503、overloaded 等）
- **自动重试** — 失败后等待后重试同一迭代，不消耗迭代次数
- **连续失败停机** — 达到上限后发送飞书通知并停机（默认 5 次）
- **飞书通知** — 失败、停机、完成时发送富文本卡片通知
- **本地日志** — 所有事件写入 `ralph.log`

## 核心概念

### 每次迭代 = 全新上下文

每次迭代启动一个**全新的 Claude Code 实例**，上下文完全清空。迭代间的唯一记忆是：
- Git 历史（前序迭代的提交）
- `progress.txt`（经验和上下文）
- `prd.json`（哪些故事已完成）

### 任务要小

每个用户故事应小到能在一个上下文窗口内完成。如果任务太大，LLM 会在完成前耗尽上下文。

合适大小：添加数据库列、UI 组件、服务端逻辑、筛选功能

太大（需拆分）：构建整个仪表板、添加认证、重构 API

### 停止条件

当所有故事的 `passes` 为 `true` 时，Ralph 输出 `<promise>COMPLETE</promise>` 并退出循环。

## 流程图

[![Ralph Flowchart](ralph-flowchart.png)](https://snarktank.github.io/ralph/)

**[查看交互式流程图](https://snarktank.github.io/ralph/)** — 点击可逐步查看带动画的流程。

本地运行：

```bash
cd flowchart && npm install && npm run dev
```

## 前置条件

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 已安装（`npm install -g @anthropic-ai/claude-code`）
- `jq` 已安装（可选，用于 ralph.sh 读取配置文件）
- Git

## 参考

- [原版 Ralph（snarktank/ralph）](https://github.com/snarktank/ralph) — 本项目基于此优化
- [Geoffrey Huntley 的 Ralph 文章](https://ghuntley.com/ralph/)
- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code)

## 许可证

[MIT](LICENSE)
