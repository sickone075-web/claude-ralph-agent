# Multi-Repo Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let a single prd.json contain user stories that target different repositories, so Ralph can orchestrate cross-repo feature development (e.g., backend + frontend in a monorepo or separate repos).

**Architecture:** Extend the existing project config with a `repositories` map (name → path + checks). Each user story in prd.json gets an optional `repo` field pointing to a repository key. The Bash core loop (`ralph.sh`) stays unchanged — it already works at the `CLAUDE.md` prompt level. The CLAUDE.md instructions are enhanced to teach the agent how to `cd` into the correct repo path and run repo-specific checks. The Dashboard reads the new fields for display.

**Tech Stack:** TypeScript (config, dashboard types), Bash (ralph.sh — minimal changes), JSON (prd.json schema extension)

---

## Scope & Design Decisions

### What changes

1. **`~/.ralph/config.json`** — each project gains an optional `repositories` map
2. **`prd.json` schema** — adds optional `repositories` top-level object and per-story `repo` field
3. **`CLAUDE.md` agent instructions** — teaches the agent to read `repositories`, `cd` to the right repo, run repo-specific `checks`
4. **`/ralph` Skill** — updated output format includes `repositories` and per-story `repo`
5. **Dashboard types** — `PRD`, `Story` interfaces updated
6. **Dashboard UI** — Stories page shows repo badge; no other UI changes needed

### What does NOT change

- `ralph.sh` — the Bash loop is unchanged; it just launches `claude --print < CLAUDE.md`. The agent inside handles repo switching.
- `/ralph-start`, `/ralph-stop` Skills — unchanged
- Dashboard API routes — unchanged (they read/write prd.json generically)
- WebSocket server — unchanged (it watches the same files)
- `init.ts` — multi-repo config will be added via a separate `ralph add-repo` command in a future iteration, not in this plan. For now, users edit config.json directly or the `/ralph` skill populates it.

### prd.json new schema (backward compatible)

```json
{
  "project": "MyApp",
  "branchName": "ralph/my-feature",
  "description": "...",
  "repositories": {
    "backend": {
      "path": "./backend",
      "defaultBranch": "main",
      "checks": ["npm run build", "npm test"]
    },
    "frontend": {
      "path": "./frontend",
      "defaultBranch": "main",
      "checks": ["npm run build", "npm run lint"]
    }
  },
  "userStories": [
    {
      "id": "US-001",
      "title": "Add user table",
      "repo": "backend",
      "description": "...",
      "acceptanceCriteria": ["...", "质量检查通过"],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

- `repositories` is **optional**. If absent, behavior is identical to today (single-repo, agent runs checks from CLAUDE.md natural language).
- `repo` on each story is **optional**. If absent, the story targets the project root (current behavior).
- `checks` array replaces natural-language quality instructions with explicit commands.

---

## Task 1: Extend PRD TypeScript types

**Files:**
- Modify: `dashboard/src/lib/types.ts`

**Step 1: Update the `PRD` and `Story` interfaces**

Add `RepoConfig` interface and extend `PRD` with optional `repositories`, and `Story` with optional `repo`:

```typescript
export interface RepoConfig {
  path: string;
  defaultBranch?: string;
  checks?: string[];
}

export interface Story {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  notes: string;
  repo?: string;           // <-- NEW: key into PRD.repositories
  startedAt?: string;
  completedAt?: string;
  status?: StoryStatus;
}

export interface PRD {
  project: string;
  branchName: string;
  description: string;
  repositories?: Record<string, RepoConfig>;  // <-- NEW
  userStories: Story[];
}
```

**Step 2: Verify typecheck passes**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add dashboard/src/lib/types.ts
git commit -m "feat: add multi-repo types (RepoConfig, Story.repo, PRD.repositories)"
```

---

## Task 2: Update CLAUDE.md agent instructions for multi-repo

**Files:**
- Modify: `scripts/ralph/CLAUDE.md`

**Step 1: Add multi-repo section to CLAUDE.md**

After the existing "Your Task" section step 3 (branch checkout), add a new section:

```markdown
## Multi-Repository Support

If `prd.json` contains a top-level `repositories` object, this is a multi-repo project.

### How to handle multi-repo stories

1. Read the `repo` field on the current story (e.g., `"repo": "backend"`)
2. Look up the repository config in `prd.json.repositories[repo]`
3. The `path` field is relative to the project root — `cd` into it before working
4. The `checks` array contains the exact commands to run for quality gates (e.g., `["npm run build", "npm test"]`)
5. After completing work, `cd` back to the project root before updating `prd.json`

### If no `repositories` or no `repo` field

Work in the current directory as before. Use whatever quality checks the project requires (typecheck, lint, test).

### Running quality checks

If the story's repository has a `checks` array, run each command in order:
- `cd <repo-path>`
- Run each check command sequentially
- ALL checks must pass before committing
- If any check fails, fix the issue and re-run

If no `checks` array is defined, fall back to the project's standard quality commands.

### Branch management in multi-repo

- Each repository should be on the branch specified in `prd.json.branchName`
- When starting a story with a `repo` field, `cd` into that repo and ensure the correct branch is checked out
- Commit changes only in the repository you modified
```

**Step 2: Update the Quality Requirements section**

Replace the existing quality requirements with:

```markdown
## Quality Requirements

- ALL commits must pass quality checks
- If the current story has a `repo` with `checks` defined, run those exact commands
- If no `checks` are defined, use whatever quality tools the project has (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns
```

**Step 3: Commit**

```bash
git add scripts/ralph/CLAUDE.md
git commit -m "feat: add multi-repo instructions to CLAUDE.md agent prompt"
```

---

## Task 3: Update prd.json.example

**Files:**
- Modify: `scripts/ralph/prd.json.example`

**Step 1: Replace with multi-repo example**

```json
{
  "project": "MyApp",
  "branchName": "ralph/task-priority",
  "description": "Task Priority System - Add priority levels to tasks",
  "repositories": {
    "backend": {
      "path": "./backend",
      "defaultBranch": "main",
      "checks": ["npm run build", "npm test"]
    },
    "frontend": {
      "path": "./frontend",
      "defaultBranch": "main",
      "checks": ["npm run build", "npm run lint"]
    }
  },
  "userStories": [
    {
      "id": "US-001",
      "title": "Add priority field to database",
      "repo": "backend",
      "description": "As a developer, I need to store task priority so it persists across sessions.",
      "acceptanceCriteria": [
        "Add priority column to tasks table: 'high' | 'medium' | 'low' (default 'medium')",
        "Generate and run migration successfully",
        "Quality checks pass"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-002",
      "title": "Display priority indicator on task cards",
      "repo": "frontend",
      "description": "As a user, I want to see task priority at a glance.",
      "acceptanceCriteria": [
        "Each task card shows colored priority badge (red=high, yellow=medium, gray=low)",
        "Priority visible without hovering or clicking",
        "Quality checks pass",
        "Verify in browser using dev-browser skill"
      ],
      "priority": 2,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-003",
      "title": "Add priority selector to task edit",
      "repo": "frontend",
      "description": "As a user, I want to change a task's priority when editing it.",
      "acceptanceCriteria": [
        "Priority dropdown in task edit modal",
        "Saves immediately on selection change",
        "Quality checks pass",
        "Verify in browser using dev-browser skill"
      ],
      "priority": 3,
      "passes": false,
      "notes": ""
    }
  ]
}
```

**Step 2: Commit**

```bash
git add scripts/ralph/prd.json.example
git commit -m "feat: update prd.json.example with multi-repo format"
```

---

## Task 4: Update /ralph Skill for multi-repo output

**Files:**
- Modify: `skills/ralph/SKILL.md`

**Step 1: Update the output format section**

Replace the JSON output format template with:

```json
{
  "project": "[项目名称]",
  "branchName": "ralph/[feature-name-kebab-case]",
  "description": "[功能描述，中文]",
  "repositories": {
    "[repo-key]": {
      "path": "[相对路径，如 ./backend]",
      "defaultBranch": "main",
      "checks": ["构建命令", "测试命令"]
    }
  },
  "userStories": [
    {
      "id": "US-001",
      "title": "[故事标题，中文]",
      "repo": "[repo-key，对应 repositories 中的键名]",
      "description": "作为[用户角色]，我希望[功能]，以便[收益]",
      "acceptanceCriteria": [
        "标准 1",
        "标准 2",
        "质量检查通过"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

**Step 2: Add multi-repo conversion rules**

After the existing "转换规则" section, add:

```markdown
## 多仓库支持

如果目标项目是多仓库结构（monorepo 或多个独立仓库）：

1. **识别仓库结构** — 询问用户项目包含哪些仓库及其路径
2. **添加 `repositories` 对象** — 每个仓库配置 `path`、`defaultBranch` 和 `checks`
3. **为每个故事添加 `repo` 字段** — 指向 `repositories` 中的键名
4. **质量检查用 `checks` 数组** — 替代验收标准中的"类型检查通过"，改为"质量检查通过"

### 单仓库项目

如果项目只有一个仓库，`repositories` 和 `repo` 字段可以省略，保持与旧格式兼容。

### 排序规则补充

跨仓库的故事排序：
1. Schema/数据库变更（后端仓库）
2. API/服务端逻辑（后端仓库）
3. UI 组件（前端仓库）
4. 集成/端到端测试
```

**Step 3: Update the checklist**

Add to the "保存前检查清单":

```markdown
- [ ] 多仓库项目已配置 `repositories` 和每个故事的 `repo` 字段
- [ ] `checks` 数组包含该仓库实际可运行的质量检查命令
```

**Step 4: Commit**

```bash
git add skills/ralph/SKILL.md
git commit -m "feat: update /ralph skill with multi-repo prd.json format"
```

---

## Task 5: Add repo badge to Dashboard Stories UI

**Files:**
- Modify: `dashboard/src/components/kanban-card.tsx`

**Step 1: Read the current kanban-card.tsx**

Read the file to understand its current structure.

**Step 2: Add repo badge**

If `story.repo` is defined, show a small badge with the repo name next to the story ID. Use the existing `Badge` component from `@/components/ui/badge`:

```tsx
{story.repo && (
  <Badge variant="outline" className="text-xs">
    {story.repo}
  </Badge>
)}
```

Place this badge next to the story ID in the card header area.

**Step 3: Verify typecheck passes**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add dashboard/src/components/kanban-card.tsx
git commit -m "feat: show repo badge on story cards in Dashboard"
```

---

## Task 6: Add repo badge to story flow nodes

**Files:**
- Modify: `dashboard/src/components/flow/story-node.tsx`

**Step 1: Read the current story-node.tsx**

Read the file to understand its structure.

**Step 2: Add repo display**

Similar to Task 5, show the `repo` field if present. Add a small label showing which repo this story targets.

**Step 3: Verify typecheck passes**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add dashboard/src/components/flow/story-node.tsx
git commit -m "feat: show repo label on flow story nodes"
```

---

## Task 7: Add repo field to story edit dialog

**Files:**
- Modify: `dashboard/src/components/story-edit-dialog.tsx`

**Step 1: Read the current story-edit-dialog.tsx**

Read the file to understand the form structure.

**Step 2: Add repo input field**

Add an optional text input for the `repo` field in the story edit form. This allows users to set/change which repository a story targets from the Dashboard UI.

Use the existing `Input` and `Label` components. Place it after the title field:

```tsx
<div className="space-y-2">
  <Label htmlFor="repo">仓库 (可选)</Label>
  <Input
    id="repo"
    value={editedStory.repo ?? ""}
    onChange={(e) => setEditedStory({ ...editedStory, repo: e.target.value || undefined })}
    placeholder="如: backend, frontend"
  />
</div>
```

**Step 3: Verify typecheck passes**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add dashboard/src/components/story-edit-dialog.tsx
git commit -m "feat: add repo field to story edit dialog"
```

---

## Task 8: Integration verification

**Step 1: Create a test prd.json with multi-repo format**

Create a temporary `scripts/ralph/prd.json` with the multi-repo format to verify the Dashboard can read and display it correctly:

```json
{
  "project": "TestMultiRepo",
  "branchName": "ralph/test-multi-repo",
  "description": "Test multi-repo support",
  "repositories": {
    "api": {
      "path": "./api",
      "checks": ["npm test"]
    },
    "web": {
      "path": "./web",
      "checks": ["npm run build"]
    }
  },
  "userStories": [
    {
      "id": "US-001",
      "title": "Test backend story",
      "repo": "api",
      "description": "Test",
      "acceptanceCriteria": ["质量检查通过"],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-002",
      "title": "Test frontend story",
      "repo": "web",
      "description": "Test",
      "acceptanceCriteria": ["质量检查通过"],
      "priority": 2,
      "passes": true,
      "notes": ""
    }
  ]
}
```

**Step 2: Verify Dashboard typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

**Step 3: Verify that a prd.json WITHOUT `repositories` still works (backward compat)**

Test with the old format (no `repositories`, no `repo` fields) and confirm typecheck still passes and no runtime errors.

**Step 4: Revert test prd.json**

Remove the test file or restore the original.

**Step 5: Commit (if any fixes were needed)**

```bash
git commit -m "fix: integration fixes for multi-repo support"
```
