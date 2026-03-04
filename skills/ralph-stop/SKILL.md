---
name: ralph:stop
description: "停止运行中的 Ralph 自主 agent 循环。用于终止 Ralph 进程。触发词：停止 ralph、关闭 ralph、终止 ralph、ralph 停止。"
user-invocable: true
---

# Ralph 停止 — 终止自主循环

停止运行中的 Ralph 自主 agent 循环。

## 使用方法

```
/ralph-stop
```

## 执行步骤

请严格按照以下步骤操作：

### 第一步：检查 Ralph 是否在运行

使用 Read 工具读取 `scripts/ralph/.ralph-pid` 文件。

- 如果文件**不存在**：报告"Ralph 当前未在运行。"并**停止**
- 如果文件存在：提取其中的 PID 编号并继续

### 第二步：验证进程是否存活

通过 Bash 工具执行：

```bash
kill -0 <PID> 2>/dev/null && echo "alive" || echo "dead"
```

- 如果输出 "dead"：通过 Bash 工具执行 `rm scripts/ralph/.ralph-pid` 清理过期 PID 文件，然后报告"Ralph 当前未在运行（已清理过期 PID 文件）。"并**停止**
- 如果输出 "alive"：继续

### 第三步：终止进程

检测平台并终止进程树：

**Windows（MINGW/MSYS/Git Bash）：**

```bash
taskkill //pid <PID> //t //f 2>/dev/null || kill -- -<PID> 2>/dev/null || kill <PID>
```

**Unix/macOS：**

```bash
kill -- -<PID> 2>/dev/null || kill <PID>
```

使用 Bash 工具执行对应命令。如不确定平台，使用 `uname -s` 输出判断 — 如果包含 "MINGW" 或 "MSYS"，使用 Windows 命令。

### 第四步：验证终止

等待片刻后验证进程已停止：

```bash
sleep 1 && (kill -0 <PID> 2>/dev/null && echo "alive" || echo "dead")
```

- 如果仍然 "alive"：尝试 `kill -9 <PID>` 作为后备方案，然后再次检查
- 如果 "dead"：继续

### 第五步：清理 PID 文件

如果 PID 文件仍然存在，将其删除：

```bash
rm -f scripts/ralph/.ralph-pid
```

### 第六步：确认

向用户报告："Ralph 已停止（PID: <PID>）。"
