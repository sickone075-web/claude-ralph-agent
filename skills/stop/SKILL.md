---
name: ralph-stop
description: "Stop a running Ralph autonomous agent loop. Use when you want to stop Ralph. Triggers on: stop ralph, ralph stop, kill ralph, halt ralph."
user-invocable: true
---

# Ralph Stop

Stop a running Ralph autonomous agent loop.

## Usage

```
/ralph-stop
```

## The Job

Follow these steps exactly:

### Step 1: Check if Ralph is running

Read the file `scripts/ralph/.ralph-pid` using the Read tool.

- If the file **does not exist**: report "Ralph is not currently running." and **stop here**
- If the file exists: extract the PID number from it and continue

### Step 2: Verify the process is alive

Run the following via Bash tool:

```bash
kill -0 <PID> 2>/dev/null && echo "alive" || echo "dead"
```

- If the output is "dead": clean up the stale PID file by running `rm scripts/ralph/.ralph-pid` via Bash tool, then report "Ralph is not currently running (stale PID file cleaned up)." and **stop here**
- If the output is "alive": continue

### Step 3: Terminate the process

Detect the platform and kill the process tree:

**On Windows (MINGW/MSYS/Git Bash):**

```bash
taskkill //pid <PID> //t //f 2>/dev/null || kill -- -<PID> 2>/dev/null || kill <PID>
```

**On Unix/macOS:**

```bash
kill -- -<PID> 2>/dev/null || kill <PID>
```

Use the Bash tool to execute the appropriate command. Use `uname -s` output to detect the platform if unsure — if it contains "MINGW" or "MSYS", use the Windows command.

### Step 4: Verify termination

Wait briefly, then verify the process has stopped:

```bash
sleep 1 && (kill -0 <PID> 2>/dev/null && echo "alive" || echo "dead")
```

- If still "alive": try `kill -9 <PID>` as a fallback, then check again
- If "dead": continue

### Step 5: Clean up PID file

Remove the PID file if it still exists:

```bash
rm -f scripts/ralph/.ralph-pid
```

### Step 6: Confirm

Report to the user: "Ralph has been stopped (PID: <PID>)."
