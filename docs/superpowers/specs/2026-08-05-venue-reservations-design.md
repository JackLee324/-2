# 校历场地预约功能 — 设计文档

**日期**: 2026-08-05
**项目**: 清澜山幼儿园体育课程体系 CMS

## 需求概述

在校历页面右侧展示当天的场地预约信息。管理员通过后台编写和管理预约数据。点击日历时，右侧显示该天的场地预约情况。

## 设计决策

采用方案二：复用 `academic_calendar.json` 作为数据存储，扩展 calendar 路由和管理页面。理由：避免增加新的数据文件和路由模块，保持系统简洁。

## 架构

```
academic_calendar.json (扩展)
  ├── classes: string[]          ← 新增：可编辑班级列表
  ├── venueReservations: object[] ← 新增：预约记录
  ├── events: object[]           (已有)
  ├── monthlyThemes: object[]    (已有)
  └── globalNotice: object       (已有)

server/routes/calendar.js (扩展)
  ├── GET  /api/calendar/classes        ← 获取班级列表
  ├── PUT  /api/calendar/classes        ← 更新班级列表
  ├── GET  /api/calendar/reservations?date=   ← 按日期查询预约
  ├── POST /api/calendar/reservation    ← 创建预约
  ├── PUT  /api/calendar/reservation/:id ← 更新预约
  └── DELETE /api/calendar/reservation/:id ← 删除预约

public/admin.html (扩展)
  └── 新增「场地预约」管理 Tab

public/js/admin.js (扩展)
  └── 班级管理 + 预约 CRUD 逻辑

public/calendar.html (扩展)
  └── 右侧面板中显示当天预约卡片

public/js/calendar.js (扩展)
  └── 点击日期时加载当天预约

public/css/calendar.css (扩展)
  └── 预约卡片样式 (复用现有 event-detail-card 风格)
```

## 数据模型

### 班级
```json
["K1", "K2", "K3"]
```

### 预约记录
```json
{
  "id": "res_abc123",
  "date": "2026-08-05",
  "venueId": "outdoor-playground",
  "className": "K1",
  "timeSlot": "9:00-10:00"
}
```

字段说明：
- `id`: 唯一标识，使用时间戳36进制
- `date`: ISO 日期字符串 (YYYY-MM-DD)
- `venueId`: 关联 campus_venues.json 中的场地 ID
- `className`: 班级名称，引用 classes 列表
- `timeSlot`: 时间段，格式 "HH:MM-HH:MM"

## UI 设计

### 右侧面板布局 (从上到下)
1. 月度主题横幅 (已有)
2. **场地预约卡片** (新增) — 带标题 "🏟️ 场地预约"
3. 事件详情列表 (已有)

### 预约卡片样式
- 复用现有 `.event-detail-card` 样式
- 左侧色条使用主题蓝色
- 显示：场地名、班级、时间段

### 后台管理 Tab
- Tab 名称：「场地预约」
- 班级管理：添加/编辑/删除班级名称
- 预约管理：选择日期 → 场地 → 班级 → 时段 → CRUD

## 错误处理

- 班级名称为空时拒绝保存
- 预约字段不完整时返回 400
- 所有管理接口需要 admin session 验证

## 测试策略

- API 测试：验证新增端点
- 手动 E2E 测试：管理页面创建预约 → 校历页面验证展示
- UI 一致性检查：预约卡片与现有事件卡片样式一致

## 涉及文件

| 文件 | 操作 |
|------|------|
| `server/data/academic_calendar.json` | 添加 classes 和 venueReservations 字段 |
| `server/routes/calendar.js` | 添加 6 个新端点 |
| `public/admin.html` | 添加场地预约 Tab |
| `public/js/admin.js` | 添加管理逻辑 |
| `public/calendar.html` | 添加预约面板容器 |
| `public/js/calendar.js` | 添加预约加载和渲染 |
| `public/css/calendar.css` | 添加预约卡片样式 |
