#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--tool amp|claude] [--timeout minutes] [--webhook url] [max_iterations]
#   --tool      amp|claude    选择 AI 工具（默认 amp）
#   --timeout   minutes       单次迭代超时时间，单位分钟（默认 30）
#   --webhook   url           飞书 webhook URL，用于发送运行状态通知

set -e

# Parse arguments
TOOL="amp"  # Default to amp for backwards compatibility
MAX_ITERATIONS=10
TIMEOUT_MINUTES=30
WEBHOOK_URL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    --timeout)
      TIMEOUT_MINUTES="$2"
      shift 2
      ;;
    --timeout=*)
      TIMEOUT_MINUTES="${1#*=}"
      shift
      ;;
    --webhook)
      WEBHOOK_URL="$2"
      shift 2
      ;;
    --webhook=*)
      WEBHOOK_URL="${1#*=}"
      shift
      ;;
    *)
      # Assume it's max_iterations if it's a number
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# Validate tool choice
if [[ "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'amp' or 'claude'."
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
LOG_FILE="$SCRIPT_DIR/ralph.log"

# log() - 本地日志记录函数
# 用法: log "INFO" "消息内容"
# 级别: INFO, WARN, ERROR
log() {
  local level="$1"
  local message="$2"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  local entry="[$timestamp] [$level] $message"
  echo "$entry" | tee -a "$LOG_FILE"
}

# send_feishu() - 飞书富文本卡片通知函数
# 用法: send_feishu "级别" "消息内容" "当前迭代" "总迭代"
# 级别: failure(失败/红色), shutdown(停机/红色加粗), success(成功/绿色)
send_feishu() {
  local level="$1"
  local message="$2"
  local current_iter="${3:-0}"
  local total_iter="${4:-0}"

  # 未配置 webhook 时静默跳过
  if [[ -z "$WEBHOOK_URL" ]]; then
    return 0
  fi

  # 转义消息中的 JSON 特殊字符
  message="${message//\\/\\\\}"
  message="${message//\"/\\\"}"

  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

  # 根据级别设置标题和颜色
  local title color
  case "$level" in
    failure)
      title="❌ Ralph 迭代失败"
      color="red"
      ;;
    shutdown)
      title="🔴 Ralph 停机"
      color="red"
      ;;
    success)
      title="✅ Ralph 任务完成"
      color="green"
      ;;
    *)
      title="ℹ️ Ralph 通知"
      color="blue"
      ;;
  esac

  # 获取 ralph.log 最后 10 行，转义 JSON 特殊字符
  local log_tail=""
  if [[ -f "$LOG_FILE" ]]; then
    log_tail="$(tail -10 "$LOG_FILE" 2>/dev/null || echo "(无日志)")"
  else
    log_tail="(日志文件不存在)"
  fi
  # 转义反斜杠、双引号、换行符以确保 JSON 合法
  log_tail="${log_tail//\\/\\\\}"
  log_tail="${log_tail//\"/\\\"}"
  log_tail="$(echo "$log_tail" | awk '{printf "%s\\n", $0}' | sed 's/\\n$//')"

  # 停机级别使用加粗标题
  local title_tag="plain_text"
  if [[ "$level" == "shutdown" ]]; then
    title="⚠️🔴 Ralph 停机 — 连续失败已达上限"
  fi

  # 构建飞书 interactive 卡片 JSON
  local payload
  payload=$(cat <<FEISHU_EOF
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": {
        "tag": "${title_tag}",
        "content": "${title}"
      },
      "template": "${color}"
    },
    "elements": [
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": "**消息：** ${message}"
        }
      },
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": "**时间：** ${timestamp}\n**迭代进度：** ${current_iter} / ${total_iter}"
        }
      },
      {
        "tag": "hr"
      },
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": "**最近日志（最后 10 行）：**\n\`\`\`\n${log_tail}\n\`\`\`"
        }
      }
    ]
  }
}
FEISHU_EOF
  )

  # 发送请求，失败时静默忽略
  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" > /dev/null 2>&1 || true

  log "INFO" "飞书通知已发送: [$level] $message"
}

# run_with_timeout() - 跨平台超时执行函数
# 用法: run_with_timeout "命令字符串"
# 返回: 命令退出码，超时返回 124
# 输出写入 .ralph-output-tmp 临时文件
# 使用后台进程 + sleep + kill 实现，不依赖 timeout 命令
run_with_timeout() {
  local cmd="$1"
  local timeout_seconds=$((TIMEOUT_MINUTES * 60))
  local output_file="$SCRIPT_DIR/.ralph-output-tmp"

  # 在后台执行命令，输出写入临时文件
  eval "$cmd" > "$output_file" 2>&1 &
  local cmd_pid=$!

  # 启动超时监控进程
  (
    sleep "$timeout_seconds"
    # 超时后 kill 命令进程（及其子进程）
    kill "$cmd_pid" 2>/dev/null
  ) &
  local timer_pid=$!

  # 等待命令进程结束
  wait "$cmd_pid" 2>/dev/null
  local exit_code=$?

  # 清理超时监控进程
  kill "$timer_pid" 2>/dev/null
  wait "$timer_pid" 2>/dev/null

  # 判断是否因超时被 kill（信号 137=SIGKILL, 143=SIGTERM）
  if [[ $exit_code -eq 137 || $exit_code -eq 143 ]]; then
    log "ERROR" "迭代执行超时（${TIMEOUT_MINUTES} 分钟），进程已被终止"
    return 124
  fi

  return "$exit_code"
}

# check_output_valid() - 输出有效性检查函数
# 用法: check_output_valid "输出内容"
# 返回: 0 表示有效，1 表示无效
# 检查输出长度和头部 API 错误标识
check_output_valid() {
  local output="$1"

  # 检查输出长度：低于 50 字符视为无效
  if [[ ${#output} -lt 50 ]]; then
    log "WARN" "输出无效：长度不足 50 字符（${#output} 字符）"
    return 1
  fi

  # 检查输出前 10 行是否包含 API 错误标识
  local head_lines
  head_lines="$(echo "$output" | head -10)"

  # 转为小写进行匹配
  local head_lower
  head_lower="$(echo "$head_lines" | tr '[:upper:]' '[:lower:]')"

  local -a error_patterns=(
    "rate limit"
    "overloaded"
    "529"
    "503"
    "api error"
    "econnrefused"
    "etimedout"
    "unauthorized"
  )

  for pattern in "${error_patterns[@]}"; do
    if [[ "$head_lower" == *"$pattern"* ]]; then
      log "WARN" "输出无效：前 10 行检测到 API 错误标识 '$pattern'"
      return 1
    fi
  done

  return 0
}

# Windows: ensure Claude Code can find git-bash
if [[ -z "$CLAUDE_CODE_GIT_BASH_PATH" ]] && [[ -f "/c/devTools/Git/bin/bash.exe" ]]; then
  export CLAUDE_CODE_GIT_BASH_PATH="C:\\devTools\\Git\\bin\\bash.exe"
elif [[ -z "$CLAUDE_CODE_GIT_BASH_PATH" ]] && [[ -f "/c/Program Files/Git/bin/bash.exe" ]]; then
  export CLAUDE_CODE_GIT_BASH_PATH="C:\\Program Files\\Git\\bin\\bash.exe"
fi

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
  
  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    # Archive the previous run
    DATE=$(date +%Y-%m-%d)
    # Strip "ralph/" prefix from branch name for folder
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"
    
    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"
    
    # Reset progress file for new run
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"
log "INFO" "Ralph 启动 - 工具: $TOOL, 最大迭代: $MAX_ITERATIONS, 超时: ${TIMEOUT_MINUTES}分钟"

# 启动时发送测试通知确认 webhook 可用
if [[ -n "$WEBHOOK_URL" ]]; then
  send_feishu "info" "Ralph 已启动，工具: $TOOL，最大迭代: $MAX_ITERATIONS" "0" "$MAX_ITERATIONS"
fi

# 主循环：while 循环，手动管理迭代计数器
i=1
consecutive_failures=0
MAX_CONSECUTIVE_FAILURES=5

while [[ $i -le $MAX_ITERATIONS ]]; do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="
  log "INFO" "开始迭代 $i / $MAX_ITERATIONS"

  # 使用 run_with_timeout 执行 AI 工具
  if [[ "$TOOL" == "amp" ]]; then
    run_with_timeout "cat \"$SCRIPT_DIR/prompt.md\" | amp --dangerously-allow-all"
  else
    run_with_timeout "claude --dangerously-skip-permissions --print < \"$SCRIPT_DIR/CLAUDE.md\""
  fi
  exit_code=$?

  # 读取输出
  OUTPUT=""
  if [[ -f "$SCRIPT_DIR/.ralph-output-tmp" ]]; then
    OUTPUT="$(cat "$SCRIPT_DIR/.ralph-output-tmp")"
  fi
  echo "$OUTPUT"

  # 判断是否超时
  if [[ $exit_code -eq 124 ]]; then
    consecutive_failures=$((consecutive_failures + 1))
    log "ERROR" "迭代 $i 超时（连续失败 $consecutive_failures 次）"
    send_feishu "failure" "迭代 $i 超时（${TIMEOUT_MINUTES} 分钟），连续失败 ${consecutive_failures}/${MAX_CONSECUTIVE_FAILURES} 次" "$i" "$MAX_ITERATIONS"

    if [[ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]]; then
      log "ERROR" "连续失败达 $MAX_CONSECUTIVE_FAILURES 次，停机退出"
      send_feishu "shutdown" "连续失败达 ${MAX_CONSECUTIVE_FAILURES} 次，Ralph 停机" "$i" "$MAX_ITERATIONS"
      exit 2
    fi

    log "INFO" "等待 1 小时后重试迭代 $i ..."
    sleep 3600
    continue
  fi

  # 检查输出有效性
  if ! check_output_valid "$OUTPUT"; then
    consecutive_failures=$((consecutive_failures + 1))
    log "ERROR" "迭代 $i 输出无效（连续失败 $consecutive_failures 次）"
    send_feishu "failure" "迭代 $i 输出无效，连续失败 ${consecutive_failures}/${MAX_CONSECUTIVE_FAILURES} 次" "$i" "$MAX_ITERATIONS"

    if [[ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]]; then
      log "ERROR" "连续失败达 $MAX_CONSECUTIVE_FAILURES 次，停机退出"
      send_feishu "shutdown" "连续失败达 ${MAX_CONSECUTIVE_FAILURES} 次，Ralph 停机" "$i" "$MAX_ITERATIONS"
      exit 2
    fi

    log "INFO" "等待 1 小时后重试迭代 $i ..."
    sleep 3600
    continue
  fi

  # 成功：重置连续失败计数
  consecutive_failures=0
  log "INFO" "迭代 $i 成功完成"

  # 检查 COMPLETE 信号
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    log "INFO" "所有任务完成！在迭代 $i 检测到 COMPLETE 信号"
    send_feishu "success" "所有任务已完成！在迭代 $i / $MAX_ITERATIONS 时检测到 COMPLETE 信号" "$i" "$MAX_ITERATIONS"
    exit 0
  fi

  echo "Iteration $i complete. Continuing..."
  i=$((i + 1))
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
log "WARN" "已达最大迭代次数 $MAX_ITERATIONS，仍有未完成任务"
exit 1
