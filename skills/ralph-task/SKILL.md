---
name: ralph:task
description: "将 PRD 转换为 prd.json 格式供 Ralph 自主 agent 系统使用。用于将现有需求文档转换为 Ralph 可执行的 JSON 格式。触发词：转换 PRD、生成 prd.json、Ralph 格式、创建任务。"
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

---

## 任务说明

读取 PRD（Markdown 文件或文本），将其转换为项目 `.ralph/` 目录下的 `prd.json`。

---

## 输出格式

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

---

## 转换规则

1. **每个用户故事对应一个 JSON 条目**
2. **ID**：顺序编号（US-001, US-002 等）
3. **优先级**：先按依赖顺序，再按文档顺序
4. **所有故事**：`passes: false` 且 `notes` 为空
5. **branchName**：从功能名称派生，kebab-case，前缀 `ralph/`
6. **必须添加**："类型检查通过"到每个故事的验收标准中

---

## 归档上一次运行

**在写入新的 prd.json 之前，检查是否存在来自不同功能的旧文件：**

1. 读取现有的 `prd.json`（如果存在）
2. 检查 `branchName` 是否与新功能的分支名不同
3. 如果不同且 `progress.txt` 有内容：
   - 创建归档文件夹：`.ralph/archive/YYYY-MM-DD_feature-name/`
   - 将当前 `prd.json` 和 `progress.txt` 复制到归档
   - 重置 `progress.txt`

---

## 拆分大型 PRD

如果 PRD 包含大功能，需要拆分：

**原始：**
> "添加用户通知系统"

**拆分为：**
1. US-001: 在数据库中添加 notifications 表
2. US-002: 创建发送通知的通知服务
3. US-003: 在页头添加通知铃铛图标
4. US-004: 创建通知下拉面板
5. US-005: 添加标记已读功能
6. US-006: 添加通知偏好设置页面

每个都是可以独立完成和验证的单一聚焦变更。

---

## 示例

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

---

## 保存前检查清单

保存 prd.json 前确认：

- [ ] **上一次运行已归档**（如果 prd.json 存在且 branchName 不同，先归档）
- [ ] 每个故事可在一次迭代中完成（足够小）
- [ ] 故事按依赖顺序排列（schema → 后端 → UI）
- [ ] 每个故事都有"类型检查通过"作为验收标准
- [ ] UI 故事有"使用 dev-browser skill 在浏览器中验证"作为验收标准
- [ ] 验收标准可验证（不模糊）
- [ ] 没有故事依赖排在它后面的故事
