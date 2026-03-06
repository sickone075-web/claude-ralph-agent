---
name: ralph:start
description: "启动 Ralph 自主 agent 循环。用于为活跃项目启动 Ralph 循环。触发词：启动 ralph、开始 ralph、运行 ralph、ralph 启动。"
user-invocable: true
---

# Ralph 启动 — 启动自主循环

启动 Ralph agent 循环，在项目目录中执行自主迭代。

---

## 工作流程

### 第一步：启动前检查

在执行启动命令前，确认以下条件：

1. **配置文件存在** — `~/.ralph/config.json` 可读
2. **有活跃项目** — `activeProject` 已设置
3. **PRD 已就绪** — 项目的 `.ralph/prd.json` 存在
4. **ralph.sh 可用** — `~/.ralph/ralph.sh` 存在

如果条件不满足，给出明确提示：
- 无配置文件 → 提示运行 `ralph init`
- 无活跃项目 → 提示在配置中设置活跃项目
- 无 PRD → 提示运行 `/ralph:prd` 创建需求文档，再运行 `/ralph:task` 转换为 prd.json
- 无 ralph.sh → 提示运行 `ralph init` 或 `npm install -g claude-ralph-agent`

---

### 第二步：读取项目配置

读取 `~/.ralph/config.json`，获取活跃项目的路径：

```bash
# 读取活跃项目名称和路径
cat ~/.ralph/config.json
```

---

### 第三步：启动 Ralph 循环

在项目根目录启动 ralph 循环：

```bash
cd <projectPath>
bash ~/.ralph/ralph.sh [maxIterations]
```

告知用户已启动 Ralph 循环，并显示项目路径和 PID 信息。

---

## 参数传递

`/ralph-start` 支持直接传递最大迭代次数参数：

- `/ralph-start` — 无参数，使用默认迭代次数
- `/ralph-start 5` — 最多执行 5 次迭代

---

## 注意事项

- 启动后 Ralph 会在后台持续运行
- 可使用 `/ralph:stop` 停止运行中的循环
- 每次迭代会选择优先级最高的未完成故事进行实现
- 执行日志会输出到终端
