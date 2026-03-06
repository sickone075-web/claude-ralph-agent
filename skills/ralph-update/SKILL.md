---
name: ralph:update
description: "更新项目 AI 上下文。合并 Codebase Patterns、增量刷新 CLAUDE.md。触发词：更新上下文、刷新文档、合并 patterns、update。"
user-invocable: true
---

# 更新项目 AI 上下文

将迭代中积累的 Codebase Patterns 合并到 CLAUDE.md，并增量刷新项目结构变化。

## 使用方法

```bash
/ralph:update
```

> 前提：已运行过 `/ralph:init` 生成初始 CLAUDE.md。

## 核心理念

Ralph 迭代过程中，`progress.txt` 的 `## Codebase Patterns` 章节会不断积累经过多次迭代验证的知识。但 agent 需要主动读取 progress.txt 才能获取这些知识。

将已验证的 Codebase Patterns **合并到根级 CLAUDE.md** 后，这些知识变成自动加载的上下文，agent 无需额外操作就能获取。

同时，项目结构可能在多轮迭代后发生变化（新增模块、文件重组等），需要增量刷新。

## 你的角色

你是**协调者**，负责收集变更信息并调用子智能体完成更新。

---

## 执行工作流

### 步骤 1：获取当前时间戳

```
Agent({
  subagent_type: "get-current-datetime",
  prompt: "获取当前日期时间，用于文档时间戳",
  description: "获取当前时间"
})
```

### 步骤 2：协调者自行收集变更信息

#### 2a. 检查前提条件

读取根级 CLAUDE.md，确认已存在。如果不存在，提示用户先运行 `/ralph:init`，终止流程。

#### 2b. 提取 Codebase Patterns

读取 `.ralph/progress.txt`，提取 `## Codebase Patterns` 章节内容。如果不存在或章节为空，记录为"无新 Patterns"。

#### 2c. 对比现有 CLAUDE.md

读取当前根级 CLAUDE.md 的「关键约定」章节，识别哪些 Patterns 已经存在、哪些是新增的。只传递**新增的 Patterns** 给子智能体。

#### 2d. 检测结构变化

使用 Glob 快速扫描顶层目录结构，与现有 CLAUDE.md 中记录的项目结构对比，识别：
- 新增的模块目录（需要生成新的模块级 CLAUDE.md）
- 已删除的模块目录（需要标记或清理对应 CLAUDE.md）
- package.json / 配置文件变化（可能影响快速参考和技术栈章节）

### 步骤 3：调用初始化架构师执行增量更新

**使用 `init-architect` 子智能体执行增量更新**：

```
Agent({
  subagent_type: "init-architect",
  prompt: `增量更新项目 CLAUDE.md 文档。

当前时间戳：$TIMESTAMP
工作目录：$PWD

## 更新任务（而非全量重建）

### 任务 1：合并新增 Codebase Patterns 到根级 CLAUDE.md
将以下已验证 Patterns 合并到「关键约定」章节中（去重，不要重复已有内容）：

$NEW_PATTERNS

### 任务 2：刷新快速参考和技术栈
重新扫描 package.json / 配置文件，更新「快速参考」和「技术栈」章节中过时的内容。

### 任务 3：处理结构变化
$STRUCTURE_CHANGES

- 为新增模块生成模块级 CLAUDE.md
- 更新根级 CLAUDE.md 的项目结构图
- 清理已删除模块的引用

### 任务 4：刷新常见操作指南
根据当前代码结构，更新「常见操作指南」中的文件路径。

## 重要约束
- 这是**增量更新**，保留现有文档的结构和内容
- 只修改需要变更的部分
- 更新根级 CLAUDE.md 底部的时间戳`,
  description: "增量更新项目文档"
})
```

### 步骤 4：汇总结果

```markdown
## 更新结果摘要

### Codebase Patterns 合并
- 新增 Patterns：N 条
- 已有（跳过）：N 条
- 来源：.ralph/progress.txt

### 结构变化
- 新增模块：<列表或"无">
- 删除模块：<列表或"无">
- 快速参考更新：[是/否]
- 技术栈更新：[是/否]

### 更新的文件
- 根级 CLAUDE.md：[已更新/无变化]
- 模块级 CLAUDE.md：<列表或"无变化">

### 推荐下一步
- [ ] 检查合并的 Patterns 是否准确
- [ ] 补扫新增模块：<路径>（如有）
```

---

## 安全边界

1. **只读/写文档** — 不改源代码
2. **增量更新** — 保留现有内容，只修改变化部分
3. **去重** — 不重复已合并的 Patterns

## 关键规则

1. **必须使用 Agent 工具**调用子智能体，不要自己执行扫描逻辑
2. 如果根级 CLAUDE.md 不存在，**终止并提示** `/ralph:init`
3. **协调者负责**对比新旧 Patterns 和检测结构变化（步骤 2）
4. 只将**新增内容**传递给子智能体，避免全量重建
5. 结果在主对话打印摘要，全文由子智能体写入仓库
