# Ralph Agent Instructions

## Overview

Ralph 是一个自主 AI Agent 循环系统，重复运行 Claude Code 直到所有 PRD 需求完成。每次迭代都是全新实例，记忆通过 Git 历史、`progress.txt` 和 `prd.json` 持久化。

**核心特性**：
- 🔄 自动循环执行用户故事
- 📦 支持多仓库协同（docs → backend → frontend）
- 🎯 优先级驱动的任務编排
- 🛡️ API 容错机制（超时保护、自动重试）
- 🔔 飞书通知集成

## 快速命令

```bash
# 开发流程图
cd flowchart && npm run dev

# 构建流程图
cd flowchart && npm run build

# 运行 Ralph（默认使用 amp）
./scripts/ralph/ralph.sh [max_iterations]

# 运行 Ralph（使用 Claude Code）
./scripts/ralph/ralph.sh --tool claude [max_iterations]

# 带飞书通知运行
./scripts/ralph/ralph.sh --tool claude --webhook <URL> 10
```

## 核心文件

| 文件 | 说明 |
|------|------|
| `scripts/ralph/ralph.sh` | Bash 循环脚本，支持 `--tool amp` 或 `--tool claude` |
| `scripts/ralph/prompt.md` | 每次迭代给 Claude Code 的指令模板 |
| `scripts/ralph/CLAUDE.md` | Claude Code 实例的上下文指令 |
| `scripts/ralph/prd.json.example` | PRD 格式示例 |
| `prd.json` | 当前项目的需求和用户故事（运行时生成） |
| `progress.txt` | 迭代经验累积日志 |
| `flowchart/` | 交互式 React Flow 流程图 |

## 项目结构

```
claude-ralph/
├── src/                      # CLI 源码（TypeScript）
│   ├── bin/ralph.ts          # CLI 入口
│   ├── commands/             # 子命令（init, start, stop, add-project, etc.）
│   └── lib/global-config.ts  # 全局配置 (~/.ralph/config.json)
├── dashboard/                # Web 控制台（Next.js 16）
│   ├── server/ws.ts          # WebSocket 实时更新
│   └── src/app/              # 6 个页面 + 14 个 API 路由
├── scripts/ralph/            # 核心循环脚本
│   ├── ralph.sh              # 主循环（含 API 容错）
│   ├── CLAUDE.md             # Claude Code 实例指令
│   ├── prompt.md             # 迭代提示模板
│   └── prd.json.example      # prd.json 示例
├── skills/                   # Claude Code 插件技能
│   ├── prd/SKILL.md          # PRD 生成（头脑风暴 + 需求讨论）
│   ├── ralph/SKILL.md        # PRD 转 JSON
│   ├── start/SKILL.md        # 启动 Ralph
│   └── stop/SKILL.md         # 停止 Ralph
└── flowchart/                # 流程图可视化（Vite + React）
```

## 工作流程

### 1. 创建 PRD
```
在 Claude Code 中：加载 prd skill，为 [功能描述] 创建 PRD
→ 输出：tasks/prd-[功能].md
```

### 2. 转换为 Ralph 格式
```
加载 ralph skill，将 tasks/prd-[功能].md 转换为 prd.json
→ 输出：prd.json
```

### 3. 运行 Ralph
```bash
# 方式 A：Web 控制台点击启动
ralph start

# 方式 B：命令行
./scripts/ralph/ralph.sh --tool claude 10
```

### 4. 自动循环
```
每次迭代：
1. 创建功能分支 (ralph/项目名)
2. 选择优先级最高的未完成故事
3. 调用 Claude Code 实现
4. 运行质量检查 (typecheck/lint/test)
5. 提交代码，标记 passes: true
6. 追加经验到 progress.txt
7. 重复直到所有故事完成
```

## 关键模式

| 模式 | 说明 |
|------|------|
| **每次迭代 = 全新上下文** | 每次启动全新的 Claude Code 实例，上下文清空 |
| **记忆持久化** | 通过 Git 历史、`progress.txt`、`prd.json` 传递信息 |
| **任务要小** | 每个用户故事应能在一个上下文窗口内完成 |
| **多仓库优先级** | priority: 0 最先执行（docs），priority: 1+ 按顺序执行 |

## 任务大小指南

| ✅ 合适 | ❌ 太大（需拆分） |
|--------|------------------|
| 添加数据库列 | 构建整个仪表板 |
| UI 组件 | 添加完整认证系统 |
| 服务端逻辑 | 重构整个 API |
| 筛选功能 | 多模块重构 |

## 停止条件

当 `prd.json` 中所有用户故事的 `passes` 字段为 `true` 时：
- 输出 `<promise>COMPLETE</promise>`
- 退出循环
- 发送完成通知（如配置了 Webhook）

## 流程图

交互式流程图位于 `flowchart/` 目录，用于展示 Ralph 的工作原理。

**本地运行**：
```bash
cd flowchart
npm install
npm run dev
```

**访问**：`http://localhost:5173`（或输出端口）

## 配置

全局配置存储在 `~/.ralph/config.json`：

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

**在线修改**：Web 控制台 → 设置页

## API 容错

| 机制 | 说明 |
|------|------|
| 超时保护 | 单次迭代超时自动终止（默认 30 分钟） |
| 输出检查 | 检测 rate limit、503、overloaded 等错误 |
| 自动重试 | 失败后等待重试，不消耗迭代次数 |
| 连续失败停机 | 达到上限后发送飞书通知并停机 |
| 飞书通知 | 失败、停机、完成时发送富文本卡片 |
| 本地日志 | 所有事件写入 `ralph.log` |

## 更新 AGENTS.md

每次迭代后，如发现新的模式、技巧或注意事项，请更新本文档，供未来的迭代参考。

---

**记住**：你是一个自主的 AI Agent。每次迭代都是全新的开始，但你有 `progress.txt` 和 Git 历史作为记忆。充分利用它们！🚀
