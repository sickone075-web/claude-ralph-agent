---
name: ralph
description: "Convert PRDs to prd.json format for the Ralph autonomous agent system. Use when you have an existing PRD and need to convert it to Ralph's JSON format. Triggers on: convert this prd, turn this into ralph format, create prd.json from this, ralph json."
user-invocable: true
---

# Ralph PRD 转换器

将现有 PRD 转换为 Ralph 自主执行所需的 `prd.json` 格式。

## 语言要求

**JSON 中所有面向人类的文本必须使用中文**，包括：
- `description`（项目描述和用户故事描述）
- `title`（用户故事标题）
- `acceptanceCriteria`（验收标准）
- `notes`（备注）

**保持英文的字段：**
- `project`（项目名称）
- `branchName`（分支名，如 `ralph/task-priority`）
- `id`（如 `US-001`）
- `repo`（仓库名称，多仓库项目中使用）

---

## The Job

Take a PRD (markdown file or text) and convert it to `prd.json` in your ralph directory.

### 第一步：检测多仓库配置

**在开始转换之前**，读取 `~/.ralph/config.json` 检查活跃项目是否配置了 `repositories`：

```bash
# 读取活跃项目名称
ACTIVE=$(cat ~/.ralph/config.json | jq -r '.activeProject')
# 读取活跃项目的 repositories
REPOS=$(cat ~/.ralph/config.json | jq -r ".projects[] | select(.name == \"$ACTIVE\") | .repositories // empty")
```

- 如果 `repositories` 存在且非空 → **多仓库模式**
- 如果 `repositories` 不存在或为空 → **单仓库模式**（行为与以前完全一致）

---

## 输出格式

### 单仓库格式（无 repositories 配置时）

```json
{
  "project": "[项目名称]",
  "branchName": "ralph/[feature-name-kebab-case]",
  "description": "[从 PRD 标题/介绍中提取的功能描述，使用中文]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[故事标题，中文]",
      "description": "作为[用户角色]，我希望[功能]，以便[收益]",
      "acceptanceCriteria": [
        "标准 1",
        "标准 2",
        "类型检查通过"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

### 多仓库格式（有 repositories 配置时）

每个 story **必须**包含 `repo` 字段，指向 `repositories` 中的 key：

```json
{
  "project": "[项目名称]",
  "branchName": "ralph/[feature-name-kebab-case]",
  "description": "[功能描述，使用中文]",
  "userStories": [
    {
      "id": "US-001",
      "title": "定义用户 API 契约文档",
      "description": "作为后端开发者，我需要用户模块的 API 契约文档。",
      "repo": "docs",
      "acceptanceCriteria": [
        "创建 api/users.md，包含完整的 CRUD 接口定义",
        "包含请求/响应格式、错误码",
        "文档格式规范检查通过"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-002",
      "title": "实现用户 CRUD API",
      "description": "作为后端开发者，我需要按 API 契约实现用户接口。",
      "repo": "backend",
      "acceptanceCriteria": [
        "实现 GET/POST/PUT/DELETE /api/users 端点",
        "响应格式与 docs 仓库的 api/users.md 一致",
        "类型检查通过",
        "测试通过"
      ],
      "priority": 2,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-003",
      "title": "用户管理页面 UI",
      "description": "作为前端开发者，我需要用户管理界面。",
      "repo": "frontend",
      "acceptanceCriteria": [
        "创建用户列表页面，调用后端 API",
        "类型检查通过",
        "使用 dev-browser skill 在浏览器中验证"
      ],
      "priority": 3,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## 多仓库写入规则

转换完成后，**按仓库分组写入各仓库的 `scripts/ralph/prd.json`**：

### 写入流程

1. **按 `repo` 字段分组 stories** — 将所有 stories 按仓库名分组
2. **为每个有 story 的仓库生成 prd.json**：
   - 使用统一的 `project`、`branchName`、`description`
   - `userStories` 只包含该仓库的故事
   - 故事的 `priority` 在仓库内保持原始排序（不重新编号）
3. **写入路径**：`{repo.path}/scripts/ralph/prd.json`（`repo.path` 从 `~/.ralph/config.json` 的 repositories 中获取）
4. **没有 story 的仓库不生成 prd.json**
5. **单仓库项目**直接写入当前项目的 `scripts/ralph/prd.json`，无需 `repo` 字段

### 归档检查

写入每个仓库的 prd.json 之前，检查该仓库是否有旧文件需要归档：

1. 读取 `{repo.path}/scripts/ralph/prd.json`（如果存在）
2. 检查 `branchName` 是否与新功能的分支名不同
3. 如果不同且该仓库的 `progress.txt` 有内容：
   - 创建归档文件夹：`{repo.path}/scripts/ralph/archive/YYYY-MM-DD-feature-name/`
   - 将当前 prd.json 和 progress.txt 复制到归档
   - 重置 progress.txt

### 写入示例

假设 `~/.ralph/config.json` 中活跃项目的 repositories 配置为：

```json
{
  "docs": { "path": "/workspace/myapp-docs", "type": "docs", "priority": 0 },
  "backend": { "path": "/workspace/myapp-backend", "type": "backend", "priority": 1 },
  "frontend": { "path": "/workspace/myapp-frontend", "type": "frontend", "priority": 1 }
}
```

转换后写入 3 个文件：

**`/workspace/myapp-docs/scripts/ralph/prd.json`**：
```json
{
  "project": "MyApp",
  "branchName": "ralph/user-management",
  "description": "用户管理功能",
  "userStories": [
    {
      "id": "US-001",
      "title": "定义用户 API 契约文档",
      "repo": "docs",
      ...
    }
  ]
}
```

**`/workspace/myapp-backend/scripts/ralph/prd.json`**：
```json
{
  "project": "MyApp",
  "branchName": "ralph/user-management",
  "description": "用户管理功能",
  "userStories": [
    {
      "id": "US-002",
      "title": "实现用户 CRUD API",
      "repo": "backend",
      ...
    }
  ]
}
```

**`/workspace/myapp-frontend/scripts/ralph/prd.json`**：
```json
{
  "project": "MyApp",
  "branchName": "ralph/user-management",
  "description": "用户管理功能",
  "userStories": [
    {
      "id": "US-003",
      "title": "用户管理页面 UI",
      "repo": "frontend",
      ...
    }
  ]
}
```

---

## 故事大小：首要规则

**每个故事必须能在一次 Ralph 迭代（一个上下文窗口）中完成。**

Ralph 每次迭代启动一个全新的 Claude Code 实例，没有前次工作的记忆。如果故事太大，LLM 会在完成前耗尽上下文，产生质量低下的代码。

### 合适大小的故事：
- 添加数据库列和迁移
- 在现有页面上添加 UI 组件
- 用新逻辑更新服务端 action
- 添加列表筛选下拉框

### 太大的故事（需要拆分）：
- "构建整个仪表板" - 拆分为：schema、查询、UI 组件、筛选器
- "添加认证" - 拆分为：schema、中间件、登录 UI、会话处理
- "重构 API" - 拆分为每个端点或模式一个故事

**经验法则：** 如果不能用 2-3 句话描述变更，就说明它太大了。

---

## 故事排序：依赖优先

故事按优先级顺序执行。前面的故事不能依赖后面的故事。

**正确顺序：**
1. Schema/数据库变更（迁移）
2. 服务端 action / 后端逻辑
3. 使用后端的 UI 组件
4. 聚合数据的仪表板/汇总视图

**错误顺序：**
1. UI 组件（依赖尚不存在的 schema）
2. Schema 变更

### 多仓库排序

多仓库项目中，排序还需考虑**仓库执行优先级**（`ralph run-all` 按 `priority` 字段分阶段执行）：

1. **docs 仓库的故事排在最前**（priority 0，先执行，生成 API 契约）
2. **backend 仓库的故事排在中间**（priority 1，读取 docs 仓库的契约来实现）
3. **frontend 仓库的故事排在最后**（priority 1 但依赖 backend，或 priority 2）

**重要约束：每个 story 只能修改一个仓库。** 如果一个需求涉及多个仓库，拆分为多个 story。

---

## 验收标准：必须可验证

每条标准必须是 Ralph 能**检查**的，不能模糊。

### 好的标准（可验证）：
- "在 tasks 表中添加 `status` 列，默认值为 'pending'"
- "筛选下拉框包含选项：全部、进行中、已完成"
- "点击删除时显示确认对话框"
- "类型检查通过"
- "测试通过"

### 差的标准（模糊）：
- "正常工作"
- "用户可以轻松做 X"
- "良好的用户体验"
- "处理边界情况"

### 每个故事最后必须包含：
```
"类型检查通过"
```

对有可测试逻辑的故事，还需包含：
```
"测试通过"
```

### 对变更 UI 的故事，还需包含：
```
"使用 dev-browser skill 在浏览器中验证"
```

前端故事在视觉验证通过前不算完成。Ralph 会使用 dev-browser skill 导航到页面、与 UI 交互并确认变更有效。

### 文档仓库（type=docs）的故事：

文档仓库不需要"类型检查通过"，改为：
```
"文档格式规范检查通过"
```

---

## 转换规则

1. **每个用户故事对应一个 JSON 条目**
2. **ID**：顺序编号（US-001, US-002 等），跨仓库全局编号
3. **优先级**：先按依赖顺序，再按文档顺序
4. **所有故事**：`passes: false` 且 `notes` 为空
5. **branchName**：从功能名称派生，kebab-case，前缀 `ralph/`
6. **必须添加**："类型检查通过"到每个故事的验收标准中（docs 仓库除外）
7. **多仓库项目**：每个 story 必须有 `repo` 字段，值为 `repositories` 中的 key
8. **单仓库项目**：story 不需要 `repo` 字段

---

## 拆分大型 PRD

如果 PRD 包含大功能，需要拆分：

**原始：**
> "添加用户通知系统"

**拆分为（单仓库）：**
1. US-001: 在数据库中添加 notifications 表
2. US-002: 创建发送通知的通知服务
3. US-003: 在页头添加通知铃铛图标
4. US-004: 创建通知下拉面板
5. US-005: 添加标记已读功能
6. US-006: 添加通知偏好设置页面

**拆分为（多仓库）：**
1. US-001 (docs): 定义通知 API 契约文档
2. US-002 (backend): 在数据库中添加 notifications 表
3. US-003 (backend): 创建发送通知的 API 端点
4. US-004 (frontend): 在页头添加通知铃铛图标
5. US-005 (frontend): 创建通知下拉面板
6. US-006 (frontend): 添加标记已读功能

每个都是可以独立完成和验证的单一聚焦变更。

---

## 示例

### 单仓库示例

**输入 PRD：**
```markdown
# 任务状态功能

添加使用不同状态标记任务的功能。

## 需求
- 在任务列表中切换 待处理/进行中/已完成
- 按状态筛选列表
- 在每个任务上显示状态徽标
- 在数据库中持久化状态
```

**输出 prd.json：**
```json
{
  "project": "TaskApp",
  "branchName": "ralph/task-status",
  "description": "任务状态功能 - 通过状态标识跟踪任务进度",
  "userStories": [
    {
      "id": "US-001",
      "title": "在 tasks 表中添加状态字段",
      "description": "作为开发者，我需要在数据库中存储任务状态。",
      "acceptanceCriteria": [
        "添加 status 列：'pending' | 'in_progress' | 'done'（默认 'pending'）",
        "成功生成并运行迁移",
        "类型检查通过"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-002",
      "title": "在任务卡片上显示状态徽标",
      "description": "作为用户，我希望一眼看到任务状态。",
      "acceptanceCriteria": [
        "每张任务卡片显示彩色状态徽标",
        "徽标颜色：灰色=待处理，蓝色=进行中，绿色=已完成",
        "类型检查通过",
        "使用 dev-browser skill 在浏览器中验证"
      ],
      "priority": 2,
      "passes": false,
      "notes": ""
    }
  ]
}
```

### 多仓库示例

**项目配置（~/.ralph/config.json 中的 repositories）：**
```json
{
  "docs": { "path": "/workspace/taskapp-docs", "type": "docs", "priority": 0 },
  "backend": { "path": "/workspace/taskapp-api", "type": "backend", "priority": 1 },
  "frontend": { "path": "/workspace/taskapp-web", "type": "frontend", "priority": 1 }
}
```

**输入 PRD：**
```markdown
# 任务状态功能（多仓库）

添加使用不同状态标记任务的功能。前后端分离架构。

## 需求
- 定义任务状态 API 契约
- 后端实现状态 CRUD
- 前端显示状态徽标和切换
```

**转换后生成 3 个 prd.json 文件：**

**写入 `/workspace/taskapp-docs/scripts/ralph/prd.json`：**
```json
{
  "project": "TaskApp",
  "branchName": "ralph/task-status",
  "description": "任务状态功能 - 通过状态标识跟踪任务进度",
  "userStories": [
    {
      "id": "US-001",
      "title": "定义任务状态 API 契约",
      "description": "作为开发团队，我需要任务状态相关接口的 API 契约文档。",
      "repo": "docs",
      "acceptanceCriteria": [
        "创建 api/task-status.md，定义 PATCH /tasks/:id/status 接口",
        "包含请求体格式、响应格式、状态枚举值定义",
        "包含错误码说明（404 任务不存在、400 无效状态值）",
        "文档格式规范检查通过"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

**写入 `/workspace/taskapp-api/scripts/ralph/prd.json`：**
```json
{
  "project": "TaskApp",
  "branchName": "ralph/task-status",
  "description": "任务状态功能 - 通过状态标识跟踪任务进度",
  "userStories": [
    {
      "id": "US-002",
      "title": "在 tasks 表中添加状态字段",
      "description": "作为后端开发者，我需要在数据库中存储任务状态。",
      "repo": "backend",
      "acceptanceCriteria": [
        "添加 status 列：'pending' | 'in_progress' | 'done'（默认 'pending'）",
        "成功生成并运行迁移",
        "类型检查通过"
      ],
      "priority": 2,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-003",
      "title": "实现任务状态更新 API",
      "description": "作为后端开发者，我需要按 API 契约实现状态更新端点。",
      "repo": "backend",
      "acceptanceCriteria": [
        "实现 PATCH /tasks/:id/status 端点",
        "响应格式与 docs 仓库 api/task-status.md 契约一致",
        "类型检查通过",
        "测试通过"
      ],
      "priority": 3,
      "passes": false,
      "notes": ""
    }
  ]
}
```

**写入 `/workspace/taskapp-web/scripts/ralph/prd.json`：**
```json
{
  "project": "TaskApp",
  "branchName": "ralph/task-status",
  "description": "任务状态功能 - 通过状态标识跟踪任务进度",
  "userStories": [
    {
      "id": "US-004",
      "title": "在任务卡片上显示状态徽标",
      "description": "作为用户，我希望一眼看到任务状态。",
      "repo": "frontend",
      "acceptanceCriteria": [
        "每张任务卡片显示彩色状态徽标",
        "徽标颜色：灰色=待处理，蓝色=进行中，绿色=已完成",
        "类型检查通过",
        "使用 dev-browser skill 在浏览器中验证"
      ],
      "priority": 4,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-005",
      "title": "在任务列表行添加状态切换",
      "description": "作为用户，我希望直接在列表中更改任务状态。",
      "repo": "frontend",
      "acceptanceCriteria": [
        "每行包含状态下拉框或切换按钮",
        "更改状态调用 PATCH /tasks/:id/status API",
        "UI 无需刷新页面即可更新",
        "类型检查通过",
        "使用 dev-browser skill 在浏览器中验证"
      ],
      "priority": 5,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## 归档上一次运行

**在写入新的 prd.json 之前，检查是否存在来自不同功能的旧文件：**

### 单仓库归档

1. 读取现有的 `prd.json`（如果存在）
2. 检查 `branchName` 是否与新功能的分支名不同
3. 如果不同且 `progress.txt` 有内容：
   - 创建归档文件夹：`archive/YYYY-MM-DD-feature-name/`
   - 将当前 `prd.json` 和 `progress.txt` 复制到归档
   - 重置 `progress.txt`

### 多仓库归档

对**每个**有 story 的仓库，在写入该仓库的 prd.json 之前：

1. 读取 `{repo.path}/scripts/ralph/prd.json`（如果存在）
2. 检查 `branchName` 是否与新功能的分支名不同
3. 如果不同且该仓库的 `progress.txt` 有内容：
   - 创建归档文件夹：`{repo.path}/scripts/ralph/archive/YYYY-MM-DD-feature-name/`
   - 将当前 prd.json 和 progress.txt 复制到归档
   - 重置 progress.txt

**ralph.sh 脚本会在运行时自动处理此操作**，但如果你在运行之间手动更新 prd.json，请先归档。

---

## 保存前检查清单

保存 prd.json 前确认：

- [ ] **上一次运行已归档**（如果 prd.json 存在且 branchName 不同，先归档）
- [ ] 每个故事可在一次迭代中完成（足够小）
- [ ] 故事按依赖顺序排列（schema → 后端 → UI）
- [ ] 每个故事都有"类型检查通过"作为验收标准（docs 仓库用"文档格式规范检查通过"）
- [ ] UI 故事有"使用 dev-browser skill 在浏览器中验证"作为验收标准
- [ ] 验收标准可验证（不模糊）
- [ ] 没有故事依赖排在它后面的故事
- [ ] **多仓库项目**：每个 story 都有 `repo` 字段
- [ ] **多仓库项目**：每个 story 只修改一个仓库
- [ ] **多仓库项目**：按仓库分组写入各仓库的 `scripts/ralph/prd.json`
- [ ] **多仓库项目**：各仓库写入前已检查归档
