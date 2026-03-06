# Claude Ralph Agent

Claude Code 自主 AI agent 循环系统，提供全局 CLI 管理工具和可视化 Web 控制台。

## Quick Reference

```bash
# 构建 CLI
npm run build

# 类型检查
npm run typecheck

# 构建 dashboard
cd dashboard && npm run build

# 开发模式启动 dashboard（Vite + Express 同时启动）
cd dashboard && npm run dev

# 发布前完整构建（CLI + dashboard + esbuild bundle server）
npm run prepublishOnly

# 运行 Ralph 循环（项目目录下）
bash ~/.ralph/ralph.sh --tool claude --timeout 30 10

# 启动 Web 控制台
ralph dashboard
```

## Architecture

```
ralph/
├── src/                          # CLI 源码（TypeScript, ESM）
│   ├── bin/ralph.ts              # CLI 入口（commander）
│   ├── commands/                 # 子命令
│   │   ├── init.ts               # 交互式初始化（inquirer）
│   │   ├── dashboard.ts          # 启动 Web 控制台
│   │   └── add-project.ts        # 添加项目
│   └── lib/
│       └── global-config.ts      # ~/.ralph/config.json 读写
├── dashboard/                    # Web 控制台（Vite + React 19 + Express）
│   ├── server/                   # Express 后端
│   │   ├── index.ts              # HTTP + WebSocket 服务
│   │   ├── log-cache.ts          # 日志缓存
│   │   └── routes/               # REST API 路由
│   │       ├── ralph.ts          # 启停 Ralph 循环
│   │       ├── prd.ts            # PRD 读写
│   │       ├── config.ts         # 配置管理
│   │       ├── projects.ts       # 多项目管理
│   │       ├── logs.ts           # 日志查询
│   │       ├── archives.ts       # 归档历史
│   │       └── git.ts            # Git 操作
│   └── src/                      # React 前端
│       ├── pages/                # 页面（dashboard, settings）
│       ├── components/           # 业务组件 + shadcn/ui
│       │   ├── flow/             # React Flow 看板节点
│       │   ├── sidebar.tsx       # 侧边栏导航
│       │   └── websocket-provider.tsx
│       ├── hooks/                # WebSocket hook
│       └── lib/                  # 工具库
│           ├── types.ts          # PRD/Story/Progress 类型定义
│           ├── store.ts          # Zustand 状态管理
│           ├── ralph-process.ts  # Ralph 进程管理
│           ├── config.ts         # 项目路径解析
│           └── prd-file.ts       # PRD 文件操作
├── scripts/ralph/                # 核心 Shell 脚本（源码，安装时复制到 ~/.ralph/）
│   ├── ralph.sh                  # 主循环（超时/重试/飞书通知）
│   └── CLAUDE.md                 # agent 实例指令（每次迭代加载）
├── skills/                       # Claude Code 插件技能
│   ├── ralph-init/               # /ralph:init — 生成项目 CLAUDE.md
│   ├── ralph-update/             # /ralph:update — 增量更新 CLAUDE.md
│   ├── ralph-prd/                # /ralph:prd — 生成 PRD
│   ├── ralph-task/               # /ralph:task — PRD -> prd.json
│   ├── ralph-start/              # /ralph:start — 启动循环
│   └── ralph-stop/               # /ralph:stop — 停止循环
├── .claude-plugin/               # Claude Code Marketplace 注册
│   ├── plugin.json               # 插件元数据
│   └── marketplace.json          # Marketplace 配置
├── design-system/MASTER.md       # Dashboard 设计系统规范
└── flowchart/                    # 交互式流程图（React Flow, 独立 Vite 应用）
```

### Three-Layer Runtime Directory Structure

```
~/.ralph/                           # 全局层（脚本、配置）
├── ralph.sh                        # 主循环脚本（唯一一份）
├── CLAUDE.md                       # agent 通用指令
├── config.json                     # 全局配置
└── projects/                       # 运行时状态（按项目隔离）
    └── <project-name>/
        ├── .ralph-pid              # 进程 PID
        ├── .circuit-breaker        # 断路器状态
        ├── .ralph-session          # 会话 ID
        ├── .last-git-hash          # 停滞检测
        └── ralph.log               # 运行日志

<project-root>/                     # 项目层
└── .ralph/                         # 项目级 Ralph 目录
    ├── prd.json                    # 当前 PRD
    ├── progress.txt                # 当前进度
    ├── .last-branch                # 上次分支名
    └── archive/                    # 历史归档
        └── <date>_<branch-name>/
            ├── prd.json
            └── progress.txt
```

## Tech Stack

| 层 | 技术 |
|----|------|
| CLI | TypeScript, Commander, Inquirer, Chalk |
| Dashboard 前端 | React 19, Vite 6, React Router 7, Zustand, shadcn/ui, Tailwind 4, React Flow |
| Dashboard 后端 | Express 5, WebSocket (ws), Chokidar (文件监听), simple-git |
| Agent 循环 | Bash (ralph.sh), Claude Code CLI (`--dangerously-skip-permissions --print`) |
| 构建/发布 | TypeScript (CLI), Vite (前端), esbuild (server bundle), npm publish |

## Key Concepts

### Every Iteration = Fresh Context

每次 Ralph 迭代启动一个全新的 Claude Code 实例，上下文完全清空。迭代间记忆仅通过：
- **Git 历史** — 前序迭代的提交
- **progress.txt** — 经验和 Codebase Patterns
- **prd.json** — 哪些故事已完成 (`passes: true/false`)

### Story 应该足够小

每个用户故事必须能在一个上下文窗口内完成。太大的任务需要拆分。

### 停止条件

所有故事 `passes: true` 时，Claude 输出 `<promise>COMPLETE</promise>`，ralph.sh 检测到后退出循环。

## Configuration

全局配置: `~/.ralph/config.json`

```typescript
interface RalphConfig {
  defaultTool: string;           // "claude" | "amp"
  defaultMaxIterations: number;  // 默认 10
  timeoutMinutes: number;        // 默认 30
  maxConsecutiveFailures: number; // 默认 5，连续失败停机阈值
  retryIntervalSeconds: number;  // 默认 3600，失败后等待秒数
  webhookUrl: string;            // 飞书 Webhook URL
  gitBashPath: string;           // Windows Git Bash 路径
  port: number;                  // Dashboard HTTP 端口，默认 3000
  wsPort: number;                // 预留，当前 WebSocket 与 HTTP 同端口
  terminalFontSize: number;      // 默认 14
  autoOpenBrowser: boolean;      // 默认 true
  activeProject: string;         // 当前活跃项目名
  projects: ProjectConfig[];     // { name, path }[]
}
```

## API Resilience (ralph.sh)

ralph.sh 内置容错机制：
- **超时保护** — `run_with_timeout()` 使用后台进程 + kill 实现，超时返回 exit code 124
- **输出有效性检查** — `check_output_valid()` 检测长度不足和 API 错误标识 (rate limit, 503, overloaded 等)
- **重试策略** — 失败后等待 `retryIntervalSeconds` 秒重试同一迭代，不消耗迭代次数
- **连续失败停机** — 达到 `maxConsecutiveFailures` 后退出，发飞书通知
- **飞书通知** — failure/shutdown/success 三级别富文本卡片

## Dashboard Real-time Updates

- Express 与 WebSocket 共用同一 HTTP 端口 (`/ws` 路径)
- Chokidar 监听 `prd.json`, `progress.txt`, `.ralph-pid` 文件变化
- `ralph-process.ts` 管理进程状态，支持 dashboard 启动和外部 PID 文件检测
- `broadcast()` 推送事件: `ralph:status`, `ralph:iteration`, `ralph:output`, `prd:updated`, `progress:updated`

## Design System

Dashboard 采用 Claude 风格暖色调设计，详见 `design-system/MASTER.md`：
- 暖色底: `#F5F5F0` (cream), 白色卡片
- 主色调: `#C15F3C` (terracotta)
- 字体: Cormorant Garamond (标题), Inter (正文), JetBrains Mono (代码/ID)

## File Protection (Three-Layer)

Ralph 实现三层文件完整性保护，防止 agent 迭代中意外破坏关键文件：

| Layer | 位置 | 机制 |
|-------|------|------|
| 1. 启动校验 | `ralph.sh` `validate_integrity()` | 循环启动前验证关键文件存在，缺失则拒绝启动 (exit 3) |
| 2. Agent 指令 | `~/.ralph/CLAUDE.md` | PROTECTED FILES 区块明确告知 agent 不可修改的文件 |
| 3. 迭代后校验 | `ralph.sh` `verify_checksums()` | 每次迭代前快照 MD5，迭代后对比，篡改则紧急停机 (exit 4) |

受保护文件：`~/.ralph/CLAUDE.md`, `~/.ralph/ralph.sh`, `~/.ralph/config.json`
特殊规则：`prd.json` 仅允许更新 `passes` 字段，`progress.txt` 仅允许追加

Exit codes: 0=完成, 1=达到最大迭代, 2=连续失败停机, 3=完整性校验失败, 4=文件被篡改, 5=断路器 OPEN

## Circuit Breaker (断路器模式)

借鉴微服务架构的三状态断路器，防止 agent 在无进展时无限循环：

```
CLOSED (正常运行) → 连续无进展 → OPEN (停机冷却)
                                      ↓ 冷却到期
                                  HALF_OPEN (试探)
                                   ↓ 成功 → CLOSED
                                   ↓ 失败 → OPEN
```

- 触发条件：连续 `CB_NO_PROGRESS_THRESHOLD` 次迭代无 git 提交（通过 `.last-git-hash` 对比）
- 冷却时间：`CB_COOLDOWN_MINUTES`（默认 30 分钟）
- 状态文件：`~/.ralph/projects/<name>/.circuit-breaker`（格式 `STATE|FAILURES|OPENED_AT|LAST_CHANGE`）
- CLI 参数：`--reset-circuit` 强制重置为 CLOSED
- 关键函数：`cb_init()`, `cb_read()`, `cb_write()`, `cb_should_run()`, `cb_record_success()`, `cb_record_failure()`, `cb_try_recover()`, `cb_check_stagnation()`

## Dual Exit Gate (双重退出门控)

循环终止需同时满足两个独立条件，避免误判完成或无限循环：

1. **显式退出信号** — `<promise>COMPLETE</promise>` 或 `EXIT_SIGNAL: true`
2. **完成指标 ≥ 2** — 启发式检测输出中的完成语句（"all stories complete", "all tasks done" 等）+ prd.json 全部 passes

两个条件缺一不可。`evaluate_exit()` 统一判定，`check_exit_signal()` + `count_completion_indicators()` 分别检测。

## Three-Layer API Limit Detection (三层 API 限额检测)

`detect_api_limit()` 纵深防御，避免将 API 限流误判为常规失败：

| Layer | 检测方式 | 触发条件 |
|-------|----------|----------|
| 1. 超时+提示 | exit code 124 + 输出含 rate/limit/quota | `API_LIMIT_TYPE=timeout+rate_hint` |
| 2. JSON 事件 | 输出含 `rate_limit_event` | `API_LIMIT_TYPE=rate_limit_event` |
| 3. 文本匹配 | 最后 30 行含 rate limit/429/quota exceeded 等 | `API_LIMIT_TYPE=text_match:*` |

检测到 API limit 时 `check_output_valid()` 返回 2（区别于 0=valid, 1=invalid），触发等待重试而非计入失败。

## Session Continuity (会话连续性)

跨迭代保持 Claude Code 会话上下文（`--resume SESSION_ID`）：

- `--session-continuity` 启用，`--session-expiry N` 设置过期小时数（默认 24）
- 状态文件：`~/.ralph/projects/<name>/.ralph-session`（格式 `SESSION_ID|TIMESTAMP`）
- 断路器触发 OPEN 时自动 `session_reset()` 清理污染上下文
- `build_claude_cmd()` 自动拼接 `--resume` 参数

## Development Conventions

- **语言**: 全中文（PRD、进度报告、CLI 提示、用户文档）
- **模块系统**: ESM (`"type": "module"` in package.json)
- **CLI 发布**: `npm publish` 分发，`bin.ralph` 指向 `dist/bin/ralph.js`
- **Dashboard 发布**: Vite 构建前端到 `dashboard/dist/`，esbuild 打包 server 到 `dist/dashboard-server.cjs`
- **Git 提交**: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`)
- **分支策略**: `main` 为主分支，功能开发使用 `ralph/<feature>` 分支

## Patterns & Gotchas

- Windows 上 Claude Code 需要 `CLAUDE_CODE_GIT_BASH_PATH` 环境变量指向 bash.exe
- 启动 ralph.sh 前需 `unset CLAUDECODE` 防止嵌套会话报错
- Dashboard server 在 npm 发布时使用 esbuild 打包为单文件 CJS (`dist/dashboard-server.cjs`)，开发时用 tsx 直接运行
- `writeConfig()` 使用原子写入（写临时文件 + rename）避免竞态
- Ralph 进程管理通过 PID 文件实现互斥，支持 dashboard 启动和外部 CLI 启动两种模式
- WebSocket 升级在 HTTP server 的 `upgrade` 事件中处理，path 匹配 `/ws`
