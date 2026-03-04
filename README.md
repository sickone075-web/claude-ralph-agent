# Claude Ralph

![Ralph](ralph.webp)

> 基于 [snarktank/ralph](https://github.com/snarktank/ralph) 的中文优化版本，为 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 提供**多仓库协同**的自主 AI Agent 循环系统。

Ralph 是一个自主 AI Agent 管理系统，通过循环执行 Claude Code 直到所有 PRD 需求完成。每次迭代都是全新实例，记忆通过 Git 历史、`progress.txt` 和 `prd.json` 持久化。

**核心创新**：支持多仓库项目协同，可自动编排 docs → backend → frontend 的开发顺序。

---

## 🚀 快速开始

### 安装

```bash
npm install -g claude-ralph
```

### 初始化

```bash
ralph init
```

交互式引导完成：
1. ✅ 权限声明与确认
2. 🔍 环境检测（Node.js、Claude CLI）
3. 🪟 Windows Git Bash 路径配置
4. 🔔 飞书 Webhook 通知（可选）
5. ⚙️ 默认运行参数
6. 📁 首个项目配置
7. 🔌 Claude Code 插件安装

### 启动 Web 控制台

```bash
ralph start
```

访问 `http://localhost:3000`，获得：
- 📋 需求任务看板（拖拽管理优先级）
- ▶️ 启动/停止 Ralph 自动化循环
- 💻 实时终端和日志
- 📦 归档历史查看
- ⚙️ 在线配置管理

---

## 📦 核心功能

### 1. CLI 管理工具

| 命令 | 说明 |
|------|------|
| `ralph init` | 交互式初始化引导 |
| `ralph start` | 启动 Web 控制台（端口 3000 + 3001） |
| `ralph start --no-open` | 启动但不自动打开浏览器 |
| `ralph stop` | 停止 Web 控制台 |
| `ralph add-project` | 交互式添加项目 |
| `ralph add-repo` | 为当前项目添加仓库 |
| `ralph remove-repo` | 从当前项目移除仓库 |
| `ralph run-all [--repo <name>] [--type <type>]` | 按优先级编排多仓库循环 |
| `ralph --version` | 查看版本 |

> **注意**：`ralph` 是管理工具，不是 AI 对话工具。与 AI 的所有对话在 **Claude Code** 中进行。

### 2. Web 控制台（Next.js 16）

**6 个核心页面**：

| 页面 | 功能 |
|------|------|
| `/dashboard` | 需求看板 - 拖拽管理用户故事优先级 |
| `/stories` | 故事列表 - 查看所有用户故事及状态 |
| `/terminal` | 实时终端 - 查看 Ralph 运行输出 |
| `/logs` | 运行日志 - 历史迭代记录 |
| `/archives` | 归档管理 - 查看已完成的项目 |
| `/settings` | 配置管理 - 飞书 Webhook、超时参数等 |

**14 个 API 路由**：
- `POST /api/projects` - 创建/更新项目
- `POST /api/repos` - 添加仓库
- `POST /api/prd/stories` - 创建用户故事
- `POST /api/prd/stories/reorder` - 调整优先级
- `POST /api/ralph/stdin` - 向 Ralph 发送指令
- `GET /api/logs/progress` - 获取进度日志
- `POST /api/config/test-webhook` - 测试飞书通知
- ... 等

### 3. Claude Code 插件

安装 `claude-ralph` 后，Skills 随 npm 包一同分发。`ralph init` 会自动注册到 Claude Code。

**手动安装**（如自动注册失败）：
```bash
claude install "$(npm root -g)/claude-ralph/.claude-plugin"
```

**可用 Skills**：

| Skill | 命令 | 功能 |
|-------|------|------|
| **prd** | `/prd` | 生成产品需求文档（含头脑风暴 + 需求讨论） |
| **ralph** | `/ralph` | 将 PRD 转换为 `prd.json` 任务格式 |
| **start** | `/start` | 启动 Ralph 循环 |
| **stop** | `/stop` | 停止 Ralph 循环 |

---

## 🔄 工作流程

### 步骤 1：创建 PRD

在 Claude Code 中：
```
加载 prd skill，为 [用户认证系统] 创建 PRD
```

流程自动经历：
1. 🧠 **头脑风暴** - 调用 brainstorming skill 创意发散
2. ❓ **交互式澄清** - 可选择的问题收集关键信息
3. 💬 **需求讨论** - 确认细节、边界情况、技术影响
4. 📄 **生成 PRD** - 输出到 `tasks/prd-用户认证.md`

### 步骤 2：转换为 Ralph 格式

```
加载 ralph skill，将 tasks/prd-用户认证.md 转换为 prd.json
```

生成 `prd.json` 包含：
- 项目信息（名称、分支）
- 多仓库配置（docs/backend/frontend，含优先级）
- 用户故事列表（含验收标准、优先级、通过状态）

### 步骤 3：运行 Ralph

**方式 A：Web 控制台**
- 点击「启动 Ralph」按钮

**方式 B：命令行**
```bash
./scripts/ralph/ralph.sh --tool claude --timeout 30 --webhook <飞书 URL> 10
```

### 步骤 4：自动循环执行

Ralph 循环执行以下流程：

```
┌─────────────────────────────────────────────────────────┐
│  1. 创建功能分支 (ralph/项目名)                          │
│  2. 选择优先级最高的未完成用户故事                        │
│  3. 调用 Claude Code 实现该故事                          │
│  4. 运行质量检查 (typecheck/lint/test)                  │
│  5. 提交代码，标记故事 passes: true                      │
│  6. 追加经验到 progress.txt                              │
│  7. 重复直到所有故事完成                                 │
└─────────────────────────────────────────────────────────┘
```

**完成信号**：所有故事 `passes` 为 `true` 时，输出 `<promise>COMPLETE</promise>` 并退出。

---

## 🏗️ 项目架构

```
claude-ralph/
├── src/                          # CLI 源码（TypeScript）
│   ├── bin/ralph.ts              # CLI 入口（Commander）
│   ├── commands/                 # 子命令实现
│   │   ├── init.ts               # 初始化引导（Inquirer）
│   │   ├── start.ts              # 启动 Web 控制台
│   │   ├── stop.ts               # 停止控制台
│   │   ├── add-project.ts        # 添加项目
│   │   ├── add-repo.ts           # 添加仓库
│   │   ├── remove-repo.ts        # 移除仓库
│   │   └── run-all.ts            # 多仓库循环编排
│   └── lib/global-config.ts      # 全局配置读写 (~/.ralph/config.json)
│
├── dashboard/                    # Web 控制台（Next.js 16 + shadcn/ui）
│   ├── server/ws.ts              # WebSocket 实时更新
│   └── src/
│       ├── app/                  # 6 个页面 + 14 个 API 路由
│       ├── components/           # 业务组件 + shadcn/ui
│       └── lib/                  # 配置、状态管理、类型定义
│
├── scripts/ralph/                # 核心循环脚本
│   ├── ralph.sh                  # 主循环（Bash，含 API 容错）
│   ├── CLAUDE.md                 # Claude Code 实例指令
│   ├── prompt.md                 # 迭代提示模板
│   └── prd.json.example          # prd.json 示例
│
├── skills/                       # Claude Code 插件技能
│   ├── prd/SKILL.md              # PRD 生成（头脑风暴 + 需求讨论）
│   ├── ralph/SKILL.md            # PRD 转 JSON
│   ├── start/SKILL.md            # 启动 Ralph
│   └── stop/SKILL.md             # 停止 Ralph
│
├── flowchart/                    # 流程图可视化（Vite + React）
│   └── src/App.tsx               # 交互式流程图
│
└── .claude-plugin/               # Claude Code Marketplace 配置
    ├── plugin.json               # 插件元数据
    └── marketplace.json          # 市场发布信息
```

---

## ⚙️ 配置系统

所有配置统一存储在 `~/.ralph/config.json`，CLI 和 Web 控制台共享：

```json
{
  "defaultTool": "claude",           // 默认 AI 工具 (amp|claude)
  "defaultMaxIterations": 10,        // 默认最大迭代次数
  "timeoutMinutes": 30,              // 单次迭代超时（分钟）
  "maxConsecutiveFailures": 5,       // 连续失败上限
  "retryIntervalSeconds": 3600,      // 重试间隔（秒）
  "webhookUrl": "",                  // 飞书 Webhook URL
  "gitBashPath": "",                 // Windows Git Bash 路径
  "port": 3000,                      // Web 控制台端口
  "wsPort": 3001,                    // WebSocket 端口
  "terminalFontSize": 14,            // 终端字体大小
  "autoOpenBrowser": true,           // 自动打开浏览器
  "activeProject": "MyApp",          // 当前活跃项目
  "projects": [                      // 项目列表
    {
      "name": "MyApp",
      "repositories": {
        "docs": { "path": "/path/to/docs", "type": "docs", "priority": 0 },
        "backend": { "path": "/path/to/backend", "type": "backend", "priority": 1 },
        "frontend": { "path": "/path/to/frontend", "type": "frontend", "priority": 1 }
      }
    }
  ]
}
```

**在线修改**：Web 控制台 → 设置页，支持所有配置项 + 飞书 Webhook 测试。

---

## 🛡️ API 容错机制

`ralph.sh` 内置以下容错能力：

| 机制 | 说明 |
|------|------|
| **超时保护** | 单次迭代超时自动终止（默认 30 分钟） |
| **输出有效性检查** | 检测 API 错误标识（rate limit、503、overloaded 等） |
| **自动重试** | 失败后等待重试，不消耗迭代次数 |
| **连续失败停机** | 达到上限后发送飞书通知并停机 |
| **飞书通知** | 失败、停机、完成时发送富文本卡片 |
| **本地日志** | 所有事件写入 `ralph.log` |

---

## 📋 prd.json 示例

```json
{
  "project": "MyApp",
  "branchName": "ralph/user-auth",
  "description": "用户认证系统",
  "repositories": {
    "docs": { "path": "/path/to/docs", "type": "docs", "priority": 0 },
    "backend": { "path": "/path/to/backend", "type": "backend", "priority": 1, "checks": ["npm run typecheck", "npm test"] },
    "frontend": { "path": "/path/to/frontend", "type": "frontend", "priority": 1, "checks": ["npm run typecheck"] }
  },
  "userStories": [
    {
      "id": "US-001",
      "title": "定义认证 API 合同",
      "description": "作为开发者，我需要 API 合同文档，以便前后端并行开发",
      "repo": "docs",
      "acceptanceCriteria": [
        "文档包含 POST /api/auth/register 端点",
        "文档包含 POST /api/auth/login 端点",
        "Markdown 格式有效且结构良好"
      ],
      "priority": 1,
      "passes": false
    },
    {
      "id": "US-002",
      "title": "实现用户注册端点",
      "description": "作为用户，我想注册账户以访问应用",
      "repo": "backend",
      "acceptanceCriteria": [
        "POST /api/auth/register 接受 email 和 password",
        "密码哈希后存储",
        "成功返回 201 和用户对象",
        "邮箱已存在返回 409"
      ],
      "priority": 2,
      "passes": false
    }
  ]
}
```

---

## 💡 核心概念

### 每次迭代 = 全新上下文

每次迭代启动一个**全新的 Claude Code 实例**，上下文完全清空。迭代间的唯一记忆：
- 📜 Git 历史（前序迭代的提交）
- 📝 `progress.txt`（经验和上下文）
- ✅ `prd.json`（哪些故事已完成）

### 任务要小

每个用户故事应小到能在一个上下文窗口内完成。

| ✅ 合适大小 | ❌ 太大（需拆分） |
|------------|------------------|
| 添加数据库列 | 构建整个仪表板 |
| UI 组件 | 添加完整认证系统 |
| 服务端逻辑 | 重构整个 API |
| 筛选功能 | 多模块重构 |

### 多仓库优先级

- **priority: 0** - 最先执行（通常是 docs，用于生成 API 合同）
- **priority: 1** - 并行执行（backend/frontend 可同时进行）
- **priority: 2+** - 按数字顺序执行

---

## 🔧 前置条件

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | 运行 CLI 和 Dashboard |
| Claude Code | 最新 | `npm install -g @anthropic-ai/claude-code` |
| jq | 任意 | 读取配置文件（可选，推荐） |
| Git | 任意 | 版本控制 |

---

## 📦 更新

```bash
npm update -g claude-ralph
```

---

## 🎨 流程图

[![Ralph Flowchart](ralph-flowchart.png)](https://snarktank.github.io/ralph/)

**[查看交互式流程图](https://snarktank.github.io/ralph/)** — 点击可逐步查看动画。

**本地运行**：
```bash
cd flowchart && npm install && npm run dev
```

---

## 📚 参考

- [原版 Ralph（snarktank/ralph）](https://github.com/snarktank/ralph) — 本项目基于此优化
- [Geoffrey Huntley 的 Ralph 文章](https://ghuntley.com/ralph/)
- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code)

---

## 📄 许可证

[MIT](LICENSE)
