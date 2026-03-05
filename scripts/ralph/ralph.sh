#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [OPTIONS] [max_iterations]
#
# Options:
#   --tool amp|claude         选择 AI 工具（默认 amp）
#   --timeout minutes         单次迭代超时时间（默认 30）
#   --webhook url             飞书 webhook URL
#   --reset-circuit           重置断路器状态后启动
#   --session-continuity      启用会话连续性（跨迭代保持上下文）
#   --session-expiry hours    会话过期时间（默认 24 小时）
#
# Exit codes:
#   0 = 所有任务完成
#   1 = 达到最大迭代次数
#   2 = 连续失败停机
#   3 = 完整性校验失败
#   4 = 文件被篡改
#   5 = 断路器 OPEN，拒绝执行

set -e

# Allow sourcing for testing: RALPH_SOURCED=1 source ralph.sh
# Disables set -e and skips main execution (see guard before Environment Setup)
if [[ "${RALPH_SOURCED:-}" == "1" ]]; then
  set +e
fi

# =============================================================
#  CLI Argument Parsing
# =============================================================

TOOL="amp"
MAX_ITERATIONS=10
TIMEOUT_MINUTES=30
WEBHOOK_URL=""
MAX_CONSECUTIVE_FAILURES=5
RETRY_INTERVAL_SECONDS=3600
RESET_CIRCUIT=false
SESSION_CONTINUITY=false
SESSION_EXPIRY_HOURS=24

# Circuit breaker defaults (overridable via env)
CB_NO_PROGRESS_THRESHOLD="${CB_NO_PROGRESS_THRESHOLD:-3}"
CB_COOLDOWN_MINUTES="${CB_COOLDOWN_MINUTES:-30}"

_CLI_TOOL=""
_CLI_MAX_ITERATIONS=""
_CLI_TIMEOUT=""
_CLI_WEBHOOK=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)       TOOL="$2"; _CLI_TOOL=1; shift 2 ;;
    --tool=*)     TOOL="${1#*=}"; _CLI_TOOL=1; shift ;;
    --timeout)    TIMEOUT_MINUTES="$2"; _CLI_TIMEOUT=1; shift 2 ;;
    --timeout=*)  TIMEOUT_MINUTES="${1#*=}"; _CLI_TIMEOUT=1; shift ;;
    --webhook)    WEBHOOK_URL="$2"; _CLI_WEBHOOK=1; shift 2 ;;
    --webhook=*)  WEBHOOK_URL="${1#*=}"; _CLI_WEBHOOK=1; shift ;;
    --reset-circuit)       RESET_CIRCUIT=true; shift ;;
    --session-continuity)  SESSION_CONTINUITY=true; shift ;;
    --session-expiry)      SESSION_EXPIRY_HOURS="$2"; shift 2 ;;
    --session-expiry=*)    SESSION_EXPIRY_HOURS="${1#*=}"; shift ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
        _CLI_MAX_ITERATIONS=1
      fi
      shift
      ;;
  esac
done

# =============================================================
#  Config File Loading
# =============================================================

RALPH_CONFIG_FILE="$HOME/.ralph/config.json"
if [[ -f "$RALPH_CONFIG_FILE" ]] && command -v jq &>/dev/null; then
  _cfg_val=""

  if [[ -z "$_CLI_TOOL" ]]; then
    _cfg_val="$(jq -r '.defaultTool // empty' "$RALPH_CONFIG_FILE" 2>/dev/null)"
    [[ -n "$_cfg_val" ]] && TOOL="$_cfg_val"
  fi
  if [[ -z "$_CLI_MAX_ITERATIONS" ]]; then
    _cfg_val="$(jq -r '.defaultMaxIterations // empty' "$RALPH_CONFIG_FILE" 2>/dev/null)"
    [[ -n "$_cfg_val" ]] && MAX_ITERATIONS="$_cfg_val"
  fi
  if [[ -z "$_CLI_TIMEOUT" ]]; then
    _cfg_val="$(jq -r '.timeoutMinutes // empty' "$RALPH_CONFIG_FILE" 2>/dev/null)"
    [[ -n "$_cfg_val" ]] && TIMEOUT_MINUTES="$_cfg_val"
  fi
  if [[ -z "$_CLI_WEBHOOK" ]]; then
    _cfg_val="$(jq -r '.webhookUrl // empty' "$RALPH_CONFIG_FILE" 2>/dev/null)"
    [[ -n "$_cfg_val" ]] && WEBHOOK_URL="$_cfg_val"
  fi

  _cfg_val="$(jq -r '.maxConsecutiveFailures // empty' "$RALPH_CONFIG_FILE" 2>/dev/null)"
  [[ -n "$_cfg_val" ]] && MAX_CONSECUTIVE_FAILURES="$_cfg_val"

  _cfg_val="$(jq -r '.retryIntervalSeconds // empty' "$RALPH_CONFIG_FILE" 2>/dev/null)"
  [[ -n "$_cfg_val" ]] && RETRY_INTERVAL_SECONDS="$_cfg_val"

  _cfg_val="$(jq -r '.gitBashPath // empty' "$RALPH_CONFIG_FILE" 2>/dev/null)"
  [[ -n "$_cfg_val" ]] && export CLAUDE_CODE_GIT_BASH_PATH="$_cfg_val"

  _cfg_val="$(jq -r '.sessionContinuity // empty' "$RALPH_CONFIG_FILE" 2>/dev/null)"
  [[ "$_cfg_val" == "true" ]] && SESSION_CONTINUITY=true

  _cfg_val="$(jq -r '.sessionExpiryHours // empty' "$RALPH_CONFIG_FILE" 2>/dev/null)"
  [[ -n "$_cfg_val" ]] && SESSION_EXPIRY_HOURS="$_cfg_val"

  unset _cfg_val
fi
unset _CLI_TOOL _CLI_MAX_ITERATIONS _CLI_TIMEOUT _CLI_WEBHOOK

# Validate tool choice
if [[ "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'amp' or 'claude'."
  exit 1
fi

# =============================================================
#  Path Definitions
# =============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
LOG_FILE="$SCRIPT_DIR/ralph.log"
PID_FILE="$SCRIPT_DIR/.ralph-pid"
CB_STATE_FILE="$SCRIPT_DIR/.circuit-breaker"
SESSION_FILE="$SCRIPT_DIR/.ralph-session"
LAST_GIT_HASH_FILE="$SCRIPT_DIR/.last-git-hash"

# =============================================================
#  Process Lock
# =============================================================

cleanup() {
  rm -f "$PID_FILE"
}
trap cleanup EXIT

if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(cat "$PID_FILE" 2>/dev/null)"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "Error: Ralph is already running (PID $existing_pid)."
    echo "Use 'kill $existing_pid' to stop it first, or delete $PID_FILE if the process is stale."
    exit 1
  fi
  rm -f "$PID_FILE"
fi
echo $$ > "$PID_FILE"

# =============================================================
#  Logging & Notifications
# =============================================================

log() {
  local level="$1"
  local message="$2"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  local entry="[$timestamp] [$level] $message"
  echo "$entry" | tee -a "$LOG_FILE"
}

send_feishu() {
  local level="$1"
  local message="$2"
  local current_iter="${3:-0}"
  local total_iter="${4:-0}"

  if [[ -z "$WEBHOOK_URL" ]]; then
    return 0
  fi

  message="${message//\\/\\\\}"
  message="${message//\"/\\\"}"

  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

  local title color
  case "$level" in
    failure)  title="❌ Ralph 迭代失败"; color="red" ;;
    shutdown) title="⚠️🔴 Ralph 停机 — 连续失败已达上限"; color="red" ;;
    success)  title="✅ Ralph 任务完成"; color="green" ;;
    circuit)  title="🔌 Ralph 断路器状态变更"; color="orange" ;;
    *)        title="ℹ️ Ralph 通知"; color="blue" ;;
  esac

  local log_tail=""
  if [[ -f "$LOG_FILE" ]]; then
    log_tail="$(tail -10 "$LOG_FILE" 2>/dev/null || echo "(无日志)")"
  else
    log_tail="(日志文件不存在)"
  fi
  log_tail="${log_tail//\\/\\\\}"
  log_tail="${log_tail//\"/\\\"}"
  log_tail="$(echo "$log_tail" | awk '{printf "%s\\n", $0}' | sed 's/\\n$//')"

  local payload
  payload=$(cat <<FEISHU_EOF
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "tag": "plain_text", "content": "${title}" },
      "template": "${color}"
    },
    "elements": [
      { "tag": "div", "text": { "tag": "lark_md", "content": "**消息：** ${message}" } },
      { "tag": "div", "text": { "tag": "lark_md", "content": "**时间：** ${timestamp}\n**迭代进度：** ${current_iter} / ${total_iter}" } },
      { "tag": "hr" },
      { "tag": "div", "text": { "tag": "lark_md", "content": "**最近日志（最后 10 行）：**\n\`\`\`\n${log_tail}\n\`\`\`" } }
    ]
  }
}
FEISHU_EOF
  )

  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" > /dev/null 2>&1 || true

  log "INFO" "飞书通知已发送: [$level] $message"
}

# =============================================================
#  Execution: Timeout Wrapper
# =============================================================

run_with_timeout() {
  local cmd="$1"
  local timeout_seconds=$((TIMEOUT_MINUTES * 60))
  local output_file="$SCRIPT_DIR/.ralph-output-tmp"

  eval "$cmd" > "$output_file" 2>&1 &
  local cmd_pid=$!

  ( sleep "$timeout_seconds"; kill "$cmd_pid" 2>/dev/null ) &
  local timer_pid=$!

  wait "$cmd_pid" 2>/dev/null
  local exit_code=$?

  kill "$timer_pid" 2>/dev/null || true
  wait "$timer_pid" 2>/dev/null || true

  if [[ $exit_code -eq 137 || $exit_code -eq 143 ]]; then
    log "ERROR" "迭代执行超时（${TIMEOUT_MINUTES} 分钟），进程已被终止"
    return 124
  fi

  return "$exit_code"
}

# =============================================================
#  P2: Three-Layer API Limit Detection
# =============================================================
# Layer 1: exit code 124 (timeout) — handled in main loop
# Layer 2: JSON rate_limit_event parsing
# Layer 3: Text search in last 30 lines

# detect_api_limit() - 三层 API 限额检测
# 返回: 0=检测到限额, 1=未检测到
# 全局变量: API_LIMIT_TYPE 记录检测层级
API_LIMIT_TYPE=""

detect_api_limit() {
  local output="$1"
  local exit_code="${2:-0}"
  API_LIMIT_TYPE=""

  # Layer 1: exit code 124 不自动视为 API limit
  # timeout 可能是任务过大，而非 API 限额
  # 仅当 timeout + 输出中有限额关键词时才判定
  if [[ "$exit_code" -eq 124 ]]; then
    local tail_text
    tail_text="$(echo "$output" | tail -5 | tr '[:upper:]' '[:lower:]')"
    if [[ "$tail_text" == *"rate"* ]] || [[ "$tail_text" == *"limit"* ]] || [[ "$tail_text" == *"429"* ]]; then
      API_LIMIT_TYPE="timeout+rate_hint"
      log "WARN" "API 限额检测 (Layer 1): 超时 + 输出含限额关键词"
      return 0
    fi
  fi

  # Layer 2: JSON 结构化解析 rate_limit_event
  if command -v jq &>/dev/null; then
    local json_hit
    json_hit="$(echo "$output" | jq -r 'select(.type == "rate_limit_event") | .type' 2>/dev/null | head -1)"
    if [[ "$json_hit" == "rate_limit_event" ]]; then
      API_LIMIT_TYPE="json_rate_limit_event"
      log "WARN" "API 限额检测 (Layer 2): JSON rate_limit_event"
      return 0
    fi
  fi

  # Layer 3: 文本搜索最后 30 行
  local tail_30
  tail_30="$(echo "$output" | tail -30 | tr '[:upper:]' '[:lower:]')"

  local -a limit_patterns=(
    "rate limit"
    "rate_limit"
    "too many requests"
    "429"
    "quota exceeded"
    "requests per minute"
    "token limit"
    "billing"
  )

  for pattern in "${limit_patterns[@]}"; do
    if [[ "$tail_30" == *"$pattern"* ]]; then
      API_LIMIT_TYPE="text_match:$pattern"
      log "WARN" "API 限额检测 (Layer 3): 文本匹配 '$pattern'"
      return 0
    fi
  done

  return 1
}

# check_output_valid() - 输出有效性检查
# 返回: 0=有效, 1=无效（但非 API 限额）, 2=API 限额
check_output_valid() {
  local output="$1"
  local exit_code="${2:-0}"

  # 先检查 API 限额（优先级最高）
  if detect_api_limit "$output" "$exit_code"; then
    return 2
  fi

  # 检查输出长度
  if [[ ${#output} -lt 50 ]]; then
    log "WARN" "输出无效：长度不足 50 字符（${#output} 字符）"
    return 1
  fi

  # 检查前 10 行 API 错误标识
  local head_lower
  head_lower="$(echo "$output" | head -10 | tr '[:upper:]' '[:lower:]')"

  local -a error_patterns=(
    "overloaded" "529" "503" "api error"
    "econnrefused" "etimedout" "unauthorized"
  )

  for pattern in "${error_patterns[@]}"; do
    if [[ "$head_lower" == *"$pattern"* ]]; then
      log "WARN" "输出无效：前 10 行检测到 API 错误标识 '$pattern'"
      return 1
    fi
  done

  return 0
}

# =============================================================
#  P0: File Integrity Protection
# =============================================================

PROTECTED_FILES=()

validate_integrity() {
  local context="${1:-pre-loop}"
  local missing=0

  if [[ ${#PROTECTED_FILES[@]} -eq 0 ]]; then
    PROTECTED_FILES=(
      "$SCRIPT_DIR/CLAUDE.md"
      "$SCRIPT_DIR/prd.json"
    )
    if [[ -f "$RALPH_CONFIG_FILE" ]]; then
      PROTECTED_FILES+=("$RALPH_CONFIG_FILE")
    fi
  fi

  for filepath in "${PROTECTED_FILES[@]}"; do
    if [[ ! -f "$filepath" ]]; then
      log "ERROR" "[$context] 关键文件缺失: $filepath"
      missing=$((missing + 1))
    fi
  done

  local self_size
  self_size="$(wc -c < "${BASH_SOURCE[0]}" 2>/dev/null || echo 0)"
  if [[ "$self_size" -lt 100 ]]; then
    log "ERROR" "[$context] ralph.sh 文件异常（大小 ${self_size} 字节）"
    missing=$((missing + 1))
  fi

  if [[ $missing -gt 0 ]]; then
    log "ERROR" "[$context] 完整性校验失败：$missing 个关键文件异常"
    return 1
  fi
  return 0
}

snapshot_checksums() {
  CHECKSUMS_BEFORE=()
  for filepath in "${PROTECTED_FILES[@]}"; do
    if [[ -f "$filepath" ]]; then
      local cksum
      cksum="$(md5sum "$filepath" 2>/dev/null | cut -d' ' -f1 || echo "none")"
      CHECKSUMS_BEFORE+=("$filepath:$cksum")
    fi
  done
  local self_cksum
  self_cksum="$(md5sum "${BASH_SOURCE[0]}" 2>/dev/null | cut -d' ' -f1 || echo "none")"
  CHECKSUMS_BEFORE+=("${BASH_SOURCE[0]}:$self_cksum")
}

verify_checksums() {
  local tampered=0
  for entry in "${CHECKSUMS_BEFORE[@]}"; do
    local filepath="${entry%%:*}"
    local old_cksum="${entry##*:}"

    if [[ ! -f "$filepath" ]]; then
      log "ERROR" "[post-iteration] 受保护文件被删除: $filepath"
      tampered=$((tampered + 1))
      continue
    fi

    # prd.json 允许 agent 修改 passes 字段
    if [[ "$filepath" == *"prd.json" ]]; then
      continue
    fi

    local new_cksum
    new_cksum="$(md5sum "$filepath" 2>/dev/null | cut -d' ' -f1 || echo "none")"
    if [[ "$old_cksum" != "$new_cksum" ]]; then
      log "ERROR" "[post-iteration] 受保护文件被篡改: $filepath"
      tampered=$((tampered + 1))
    fi
  done

  if [[ $tampered -gt 0 ]]; then
    log "ERROR" "[post-iteration] 检测到 $tampered 个受保护文件被篡改"
    return 1
  fi
  return 0
}

# =============================================================
#  P1: Circuit Breaker (CLOSED / HALF_OPEN / OPEN)
# =============================================================
# State file format: STATE|FAILURE_COUNT|OPENED_AT_EPOCH|LAST_CHANGE_EPOCH
#
# Transitions:
#   CLOSED   → OPEN       when failures >= threshold
#   OPEN     → HALF_OPEN  when cooldown elapsed
#   HALF_OPEN → CLOSED    on success
#   HALF_OPEN → OPEN      on failure

cb_init() {
  if [[ "$RESET_CIRCUIT" == "true" ]]; then
    echo "CLOSED|0|0|$(date +%s)" > "$CB_STATE_FILE"
    log "INFO" "[断路器] 手动重置为 CLOSED"
    return
  fi

  if [[ ! -f "$CB_STATE_FILE" ]]; then
    echo "CLOSED|0|0|$(date +%s)" > "$CB_STATE_FILE"
    return
  fi
}

cb_read() {
  if [[ ! -f "$CB_STATE_FILE" ]]; then
    CB_STATE="CLOSED"; CB_FAILURES=0; CB_OPENED_AT=0; CB_LAST_CHANGE="$(date +%s)"
    return
  fi
  local line
  line="$(cat "$CB_STATE_FILE" 2>/dev/null)"
  CB_STATE="$(echo "$line" | cut -d'|' -f1)"
  CB_FAILURES="$(echo "$line" | cut -d'|' -f2)"
  CB_OPENED_AT="$(echo "$line" | cut -d'|' -f3)"
  CB_LAST_CHANGE="$(echo "$line" | cut -d'|' -f4)"

  # Fallback for corrupted state
  [[ -z "$CB_STATE" ]] && CB_STATE="CLOSED"
  [[ -z "$CB_FAILURES" ]] && CB_FAILURES=0
  [[ -z "$CB_OPENED_AT" ]] && CB_OPENED_AT=0
  [[ -z "$CB_LAST_CHANGE" ]] && CB_LAST_CHANGE="$(date +%s)"
}

cb_write() {
  echo "${CB_STATE}|${CB_FAILURES}|${CB_OPENED_AT}|$(date +%s)" > "$CB_STATE_FILE"
}

# cb_try_recover() - OPEN 状态冷却后自动恢复到 HALF_OPEN
cb_try_recover() {
  cb_read
  if [[ "$CB_STATE" != "OPEN" ]]; then
    return 0
  fi

  local now cooldown_seconds elapsed
  now="$(date +%s)"
  cooldown_seconds=$((CB_COOLDOWN_MINUTES * 60))
  elapsed=$((now - CB_OPENED_AT))

  if [[ $elapsed -ge $cooldown_seconds ]]; then
    CB_STATE="HALF_OPEN"
    CB_FAILURES=0
    cb_write
    log "INFO" "[断路器] 冷却 ${CB_COOLDOWN_MINUTES} 分钟已过，OPEN → HALF_OPEN"
    send_feishu "circuit" "断路器冷却完成，从 OPEN 恢复到 HALF_OPEN，尝试恢复执行" "0" "$MAX_ITERATIONS"
    return 0
  fi

  local remaining=$(( (cooldown_seconds - elapsed) / 60 ))
  log "WARN" "[断路器] OPEN 状态，冷却剩余 ${remaining} 分钟"
  return 1
}

# cb_should_run() - 检查断路器是否允许执行
# 返回: 0=允许, 1=拒绝
cb_should_run() {
  cb_read

  case "$CB_STATE" in
    CLOSED)   return 0 ;;
    HALF_OPEN) return 0 ;;
    OPEN)
      if cb_try_recover; then
        return 0
      fi
      return 1
      ;;
  esac
  return 0
}

# cb_record_success() - 记录成功迭代
cb_record_success() {
  cb_read
  if [[ "$CB_STATE" == "HALF_OPEN" ]]; then
    log "INFO" "[断路器] HALF_OPEN 下执行成功，HALF_OPEN → CLOSED"
    CB_STATE="CLOSED"
  fi
  CB_FAILURES=0
  cb_write
}

# cb_record_failure() - 记录失败迭代
# 参数: $1=失败原因
cb_record_failure() {
  local reason="${1:-unknown}"
  cb_read
  CB_FAILURES=$((CB_FAILURES + 1))

  if [[ "$CB_STATE" == "HALF_OPEN" ]]; then
    # HALF_OPEN 下失败，立即回到 OPEN
    CB_STATE="OPEN"
    CB_OPENED_AT="$(date +%s)"
    cb_write
    log "ERROR" "[断路器] HALF_OPEN 下失败($reason)，HALF_OPEN → OPEN"
    send_feishu "circuit" "断路器在 HALF_OPEN 试探中失败($reason)，重新进入 OPEN 冷却" "0" "$MAX_ITERATIONS"
    return
  fi

  if [[ $CB_FAILURES -ge $CB_NO_PROGRESS_THRESHOLD ]]; then
    CB_STATE="OPEN"
    CB_OPENED_AT="$(date +%s)"
    cb_write
    log "ERROR" "[断路器] 累计失败 ${CB_FAILURES} 次($reason)，CLOSED → OPEN"
    send_feishu "circuit" "断路器触发: 累计 ${CB_FAILURES} 次失败($reason)，进入 OPEN 冷却 ${CB_COOLDOWN_MINUTES} 分钟" "0" "$MAX_ITERATIONS"
    return
  fi

  cb_write
  log "WARN" "[断路器] 记录失败($reason)，累计 ${CB_FAILURES}/${CB_NO_PROGRESS_THRESHOLD}"
}

# cb_check_stagnation() - 检测代码停滞（无 git 变化）
# 返回: 0=有进展, 1=停滞
cb_check_stagnation() {
  # 需要 git 可用
  if ! command -v git &>/dev/null; then
    return 0
  fi

  # 获取当前项目根目录的 git hash
  local project_dir
  project_dir="$(cd "$SCRIPT_DIR/../.." && pwd)"
  local current_hash
  current_hash="$(git -C "$project_dir" rev-parse HEAD 2>/dev/null || echo "")"

  if [[ -z "$current_hash" ]]; then
    return 0  # 无法获取 hash，跳过检测
  fi

  if [[ -f "$LAST_GIT_HASH_FILE" ]]; then
    local last_hash
    last_hash="$(cat "$LAST_GIT_HASH_FILE" 2>/dev/null)"
    if [[ "$current_hash" == "$last_hash" ]]; then
      log "WARN" "迭代后无新 git 提交（停滞检测）"
      echo "$current_hash" > "$LAST_GIT_HASH_FILE"
      return 1
    fi
  fi

  echo "$current_hash" > "$LAST_GIT_HASH_FILE"
  return 0
}

# =============================================================
#  P1: Dual Exit Gate
# =============================================================
# 退出需同时满足:
#   1. completion_indicators >= 2（启发式模式匹配）
#   2. EXIT_SIGNAL: true 或 <promise>COMPLETE</promise>（显式信号）
# 防止误判完成导致提前退出，同时尊重 agent 的显式完成信号

# count_completion_indicators() - 计算完成指标数量
# 参数: $1=输出文本
# 返回: 全局变量 COMPLETION_INDICATORS
count_completion_indicators() {
  local output="$1"
  COMPLETION_INDICATORS=0
  local output_lower
  output_lower="$(echo "$output" | tr '[:upper:]' '[:lower:]')"

  # 指标 1: 输出中包含 "all stories" + "complete/done/passed/true"
  if [[ "$output_lower" == *"all stories"* ]] && [[ "$output_lower" == *"complete"* || "$output_lower" == *"done"* || "$output_lower" == *"passed"* || "$output_lower" == *"true"* ]]; then
    COMPLETION_INDICATORS=$((COMPLETION_INDICATORS + 1))
  fi

  # 指标 2: 输出中包含 "all tasks" + "finished/complete/done"
  if [[ "$output_lower" == *"all tasks"* ]] && [[ "$output_lower" == *"finished"* || "$output_lower" == *"complete"* || "$output_lower" == *"done"* ]]; then
    COMPLETION_INDICATORS=$((COMPLETION_INDICATORS + 1))
  fi

  # 指标 3: "nothing left to do" / "no more stories" / "no remaining"
  if [[ "$output_lower" == *"nothing left"* ]] || [[ "$output_lower" == *"no more stories"* ]] || [[ "$output_lower" == *"no remaining"* ]]; then
    COMPLETION_INDICATORS=$((COMPLETION_INDICATORS + 1))
  fi

  # 指标 4: prd.json 中所有故事 passes=true
  if command -v jq &>/dev/null && [[ -f "$PRD_FILE" ]]; then
    local total_stories passes_count
    total_stories="$(jq '[.userStories[]] | length' "$PRD_FILE" 2>/dev/null || echo 0)"
    passes_count="$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null || echo 0)"
    if [[ "$total_stories" -gt 0 ]] && [[ "$total_stories" -eq "$passes_count" ]]; then
      COMPLETION_INDICATORS=$((COMPLETION_INDICATORS + 1))
    fi
  fi
}

# check_exit_signal() - 检查显式退出信号
# 返回: 0=检测到信号, 1=未检测到
check_exit_signal() {
  local output="$1"

  # 信号 1: <promise>COMPLETE</promise>（原始机制，保持兼容）
  if echo "$output" | grep -q "<promise>COMPLETE</promise>"; then
    return 0
  fi

  # 信号 2: EXIT_SIGNAL: true
  if echo "$output" | grep -qi "EXIT_SIGNAL.*true"; then
    return 0
  fi

  return 1
}

# evaluate_exit() - 双重门控退出判定
# 返回: 0=应该退出, 1=继续执行
evaluate_exit() {
  local output="$1"
  local has_signal=false
  local indicators=0

  # 检查显式信号
  if check_exit_signal "$output"; then
    has_signal=true
  fi

  # 计算完成指标
  count_completion_indicators "$output"
  indicators=$COMPLETION_INDICATORS

  log "INFO" "[退出门控] 完成指标: $indicators, 显式信号: $has_signal"

  # 双重门控: 需要 indicators >= 2 AND 显式信号
  if [[ "$has_signal" == "true" ]] && [[ $indicators -ge 2 ]]; then
    log "INFO" "[退出门控] 双重条件满足，准备退出"
    return 0
  fi

  # 宽松路径: 显式信号 + 至少 1 个指标（防止过于严格导致无限循环）
  if [[ "$has_signal" == "true" ]] && [[ $indicators -ge 1 ]]; then
    log "INFO" "[退出门控] 显式信号 + ${indicators} 个指标，准备退出"
    return 0
  fi

  # 仅有信号无指标: 记录但不退出（可能是误判）
  if [[ "$has_signal" == "true" ]] && [[ $indicators -eq 0 ]]; then
    log "WARN" "[退出门控] 检测到显式信号但无完成指标，继续执行"
    return 1
  fi

  return 1
}

# =============================================================
#  P2: Session Continuity
# =============================================================
# 跨迭代保持 Claude Code 会话上下文
# 使用 --resume SESSION_ID 恢复对话

SESSION_ID=""

session_init() {
  if [[ "$SESSION_CONTINUITY" != "true" ]]; then
    return
  fi

  if [[ -f "$SESSION_FILE" ]]; then
    local line
    line="$(cat "$SESSION_FILE" 2>/dev/null)"
    local saved_id saved_ts
    saved_id="$(echo "$line" | cut -d'|' -f1)"
    saved_ts="$(echo "$line" | cut -d'|' -f2)"

    # 检查是否过期
    local now elapsed expiry_seconds
    now="$(date +%s)"
    expiry_seconds=$((SESSION_EXPIRY_HOURS * 3600))
    elapsed=$((now - ${saved_ts:-0}))

    if [[ $elapsed -lt $expiry_seconds ]] && [[ -n "$saved_id" ]]; then
      SESSION_ID="$saved_id"
      log "INFO" "[会话] 恢复会话 $SESSION_ID（已存续 $((elapsed / 60)) 分钟）"
      return
    else
      log "INFO" "[会话] 会话已过期（${SESSION_EXPIRY_HOURS}h），将创建新会话"
      rm -f "$SESSION_FILE"
    fi
  fi

  log "INFO" "[会话] 会话连续性已启用，首次迭代将创建新会话"
}

session_save() {
  local output="$1"
  if [[ "$SESSION_CONTINUITY" != "true" ]]; then
    return
  fi

  # 尝试从 claude --print 的 JSON 输出中提取 session_id
  if command -v jq &>/dev/null; then
    local new_id
    new_id="$(echo "$output" | jq -r '.session_id // empty' 2>/dev/null | head -1)"
    if [[ -n "$new_id" ]]; then
      SESSION_ID="$new_id"
      echo "${SESSION_ID}|$(date +%s)" > "$SESSION_FILE"
      log "INFO" "[会话] 保存会话 $SESSION_ID"
      return
    fi
  fi

  # 如果没有提取到 session_id，尝试用 claude 的 --continue 机制
  # 保持现有 SESSION_ID（如果有的话）
  if [[ -n "$SESSION_ID" ]]; then
    echo "${SESSION_ID}|$(date +%s)" > "$SESSION_FILE"
  fi
}

session_reset() {
  SESSION_ID=""
  rm -f "$SESSION_FILE"
  log "INFO" "[会话] 会话已重置"
}

# 构建 claude 命令行（含会话连续性支持）
build_claude_cmd() {
  local template="$1"
  local cmd="claude --dangerously-skip-permissions --print"

  # 会话连续性：使用 --resume 恢复对话
  if [[ "$SESSION_CONTINUITY" == "true" ]] && [[ -n "$SESSION_ID" ]]; then
    cmd="$cmd --resume $SESSION_ID"
    # resume 模式下不需要 stdin 输入初始 prompt
    echo "$cmd"
    return
  fi

  # 首次运行或无会话：使用 stdin 传入 CLAUDE.md
  cmd="$cmd < \"$template\""
  echo "$cmd"
}

# =============================================================
#  Environment Setup & Main Execution
# =============================================================

# When sourced for testing, stop here — only function definitions loaded
if [[ "${RALPH_SOURCED:-}" == "1" ]]; then
  return 0 2>/dev/null || true
fi

unset CLAUDECODE 2>/dev/null

if [[ -z "$CLAUDE_CODE_GIT_BASH_PATH" ]] && [[ -f "/c/devTools/Git/bin/bash.exe" ]]; then
  export CLAUDE_CODE_GIT_BASH_PATH="C:\\devTools\\Git\\bin\\bash.exe"
elif [[ -z "$CLAUDE_CODE_GIT_BASH_PATH" ]] && [[ -f "/c/Program Files/Git/bin/bash.exe" ]]; then
  export CLAUDE_CODE_GIT_BASH_PATH="C:\\Program Files\\Git\\bin\\bash.exe"
fi

# =============================================================
#  Archive & Branch Setup
# =============================================================

if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    DATE=$(date +%Y-%m-%d)
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"

    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

# =============================================================
#  Startup Checks
# =============================================================

echo "Starting Ralph - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"
log "INFO" "Ralph 启动 - 工具: $TOOL, 最大迭代: $MAX_ITERATIONS, 超时: ${TIMEOUT_MINUTES}分钟"

# P0: 启动前完整性校验
if ! validate_integrity "startup"; then
  log "ERROR" "启动前完整性校验失败，Ralph 拒绝启动"
  send_feishu "shutdown" "启动前完整性校验失败，关键文件缺失" "0" "$MAX_ITERATIONS"
  exit 3
fi
log "INFO" "启动前完整性校验通过"

# P1: 断路器初始化与检查
cb_init
if ! cb_should_run; then
  log "ERROR" "断路器处于 OPEN 状态，Ralph 拒绝启动（冷却中）"
  send_feishu "shutdown" "断路器 OPEN，Ralph 等待冷却" "0" "$MAX_ITERATIONS"
  exit 5
fi
cb_read
log "INFO" "断路器状态: $CB_STATE (累计失败: $CB_FAILURES)"

# P2: 会话连续性初始化
session_init

# 飞书启动通知
if [[ -n "$WEBHOOK_URL" ]]; then
  send_feishu "info" "Ralph 已启动，工具: $TOOL，最大迭代: $MAX_ITERATIONS，断路器: $CB_STATE" "0" "$MAX_ITERATIONS"
fi

# 记录初始 git hash（用于停滞检测）
cb_check_stagnation > /dev/null 2>&1

# =============================================================
#  Main Loop
# =============================================================

i=1
consecutive_failures=0
no_progress_count=0

while [[ $i -le $MAX_ITERATIONS ]]; do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="
  log "INFO" "开始迭代 $i / $MAX_ITERATIONS"

  # P1: 断路器检查（每次迭代前）
  if ! cb_should_run; then
    log "ERROR" "断路器 OPEN，等待冷却后自动恢复..."
    # 在 OPEN 期间等待冷却，而非退出
    local wait_seconds=$((CB_COOLDOWN_MINUTES * 60))
    log "INFO" "等待 ${CB_COOLDOWN_MINUTES} 分钟冷却..."
    sleep "$wait_seconds"
    # 重新检查
    if ! cb_should_run; then
      log "ERROR" "冷却后断路器仍为 OPEN，停机退出"
      send_feishu "shutdown" "断路器冷却后仍为 OPEN，Ralph 停机" "$i" "$MAX_ITERATIONS"
      exit 5
    fi
  fi

  # P0: 迭代前快照
  snapshot_checksums

  # 构建 AI 命令
  CLAUDE_TEMPLATE="$SCRIPT_DIR/CLAUDE.md"

  if [[ "$TOOL" == "amp" ]]; then
    run_with_timeout "cat \"$SCRIPT_DIR/prompt.md\" | amp --dangerously-allow-all"
  else
    local claude_cmd
    claude_cmd="$(build_claude_cmd "$CLAUDE_TEMPLATE")"
    run_with_timeout "$claude_cmd"
  fi
  exit_code=$?

  # 读取输出
  OUTPUT=""
  if [[ -f "$SCRIPT_DIR/.ralph-output-tmp" ]]; then
    OUTPUT="$(cat "$SCRIPT_DIR/.ralph-output-tmp")"
  fi
  echo "$OUTPUT"

  # ---- 失败路径 ----

  # 超时处理
  if [[ $exit_code -eq 124 ]]; then
    consecutive_failures=$((consecutive_failures + 1))

    # P2: 区分超时 vs API 限额
    if detect_api_limit "$OUTPUT" "$exit_code"; then
      log "ERROR" "迭代 $i 超时且检测到 API 限额 ($API_LIMIT_TYPE)"
      cb_record_failure "api_limit"
      send_feishu "failure" "迭代 $i 超时 + API 限额($API_LIMIT_TYPE)，等待恢复" "$i" "$MAX_ITERATIONS"
      # API 限额：等待更长时间
      log "INFO" "API 限额等待 ${RETRY_INTERVAL_SECONDS} 秒..."
      sleep "$RETRY_INTERVAL_SECONDS"
    else
      log "ERROR" "迭代 $i 超时（连续失败 $consecutive_failures 次）"
      cb_record_failure "timeout"
      send_feishu "failure" "迭代 $i 超时（${TIMEOUT_MINUTES}分钟），连续失败 ${consecutive_failures}/${MAX_CONSECUTIVE_FAILURES}" "$i" "$MAX_ITERATIONS"
      # 普通超时：短暂等待
      sleep 10
    fi

    # P2: 超时时重置会话（上下文可能已污染）
    if [[ "$SESSION_CONTINUITY" == "true" ]]; then
      session_reset
    fi

    if [[ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]]; then
      log "ERROR" "连续失败达 $MAX_CONSECUTIVE_FAILURES 次，停机退出"
      send_feishu "shutdown" "连续失败达 ${MAX_CONSECUTIVE_FAILURES} 次，Ralph 停机" "$i" "$MAX_ITERATIONS"
      exit 2
    fi
    continue
  fi

  # 输出有效性检查（含 API 限额检测）
  check_output_valid "$OUTPUT" "$exit_code"
  local validity=$?

  if [[ $validity -eq 2 ]]; then
    # API 限额
    consecutive_failures=$((consecutive_failures + 1))
    cb_record_failure "api_limit:$API_LIMIT_TYPE"
    log "ERROR" "迭代 $i 检测到 API 限额 ($API_LIMIT_TYPE)"
    send_feishu "failure" "迭代 $i API 限额($API_LIMIT_TYPE)，等待 ${RETRY_INTERVAL_SECONDS} 秒" "$i" "$MAX_ITERATIONS"
    sleep "$RETRY_INTERVAL_SECONDS"

    if [[ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]]; then
      log "ERROR" "连续失败达 $MAX_CONSECUTIVE_FAILURES 次，停机退出"
      send_feishu "shutdown" "连续失败达 ${MAX_CONSECUTIVE_FAILURES} 次（API 限额），Ralph 停机" "$i" "$MAX_ITERATIONS"
      exit 2
    fi
    continue

  elif [[ $validity -eq 1 ]]; then
    # 普通无效输出
    consecutive_failures=$((consecutive_failures + 1))
    cb_record_failure "invalid_output"
    log "ERROR" "迭代 $i 输出无效（连续失败 $consecutive_failures 次）"
    send_feishu "failure" "迭代 $i 输出无效，连续失败 ${consecutive_failures}/${MAX_CONSECUTIVE_FAILURES}" "$i" "$MAX_ITERATIONS"

    if [[ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]]; then
      log "ERROR" "连续失败达 $MAX_CONSECUTIVE_FAILURES 次，停机退出"
      send_feishu "shutdown" "连续失败达 ${MAX_CONSECUTIVE_FAILURES} 次，Ralph 停机" "$i" "$MAX_ITERATIONS"
      exit 2
    fi

    sleep 10
    continue
  fi

  # ---- 成功路径 ----

  consecutive_failures=0
  log "INFO" "迭代 $i 成功完成"

  # P1: 断路器记录成功
  cb_record_success

  # P2: 保存会话 ID
  session_save "$OUTPUT"

  # P0: 迭代后完整性校验
  if ! verify_checksums; then
    log "ERROR" "迭代 $i 后检测到关键文件被篡改，停机退出"
    send_feishu "shutdown" "迭代 $i 后检测到关键文件被篡改，Ralph 紧急停机" "$i" "$MAX_ITERATIONS"
    exit 4
  fi

  if ! validate_integrity "iteration-$i"; then
    log "ERROR" "迭代 $i 后完整性校验失败，停机退出"
    send_feishu "shutdown" "迭代 $i 后关键文件缺失，Ralph 紧急停机" "$i" "$MAX_ITERATIONS"
    exit 3
  fi

  # P1: 停滞检测（无 git 提交）
  if ! cb_check_stagnation; then
    no_progress_count=$((no_progress_count + 1))
    log "WARN" "连续 $no_progress_count 次迭代无新提交"
    if [[ $no_progress_count -ge $CB_NO_PROGRESS_THRESHOLD ]]; then
      cb_record_failure "stagnation:${no_progress_count}_iterations_no_commit"
      no_progress_count=0
    fi
  else
    no_progress_count=0
  fi

  # P1: 双重退出门控
  if evaluate_exit "$OUTPUT"; then
    echo ""
    echo "Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    log "INFO" "所有任务完成！在迭代 $i 检测到双重退出条件 (指标: $COMPLETION_INDICATORS)"
    send_feishu "success" "所有任务已完成！在迭代 $i / $MAX_ITERATIONS 时双重门控确认完成" "$i" "$MAX_ITERATIONS"
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
