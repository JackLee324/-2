# 项目结构重构 + 安全加固 — 零功能变更的可迭代性优化

## 背景

当前项目 3 个 HTML 文件均为单体文件（index.html 5972 行/242KB、admin.html 3242 行/154KB、calendar.html 1392 行/50KB），CSS 和 JS 全部内联。服务端 index.js 865 行，包含所有路由、中间件、multer 配置和数据访问逻辑。

2026-05-25 系统化代码审查发现 16 个问题：无 .gitignore、node_modules 被追踪（745 文件）、硬编码弱密码、路径遍历漏洞、非原子 JSON 写入、登录无速率限制等。

目标：在不改变任何 UI 内容、操作逻辑、部署方式的前提下，拆分文件 + 功能域隔离 + 修复审查发现的所有高危/中危问题。

## 审查发现与修复映射

| # | 问题 | 严重度 | 修复方式 |
|---|---|---|---|
| 1 | 无 `.gitignore`，`node_modules/` 被追踪 | 🔴 高 | 新增 `.gitignore`，`git rm --cached` 清理 |
| 2 | 硬编码密码 `123456` + 可猜测 token | 🔴 高 | `config.js` 外置，环境变量可覆盖 |
| 3 | DELETE /api/parkour-image 路径遍历 | 🔴 高 | 路由中加路径白名单校验 |
| 4 | 7 个 `writeFileSync` 非原子写入 | 🟠 中 | `store.js` 原子写入队列 |
| 5 | GET / 和 GET /admin 无 try-catch | 🟠 中 | 加 try-catch + 500 响应 |
| 6 | 登录无速率限制 | 🟠 中 | 简易内存限流（60s 内最多 5 次） |
| 7 | PUT /api/gallery/:id 无输入验证 | 🟠 中 | 白名单字段校验 |
| 8 | POST/PUT /api/venues 功能重复 | 🟡 低 | 合并为一个路由 |
| 9 | Date.now() 毫秒 ID 可能冲突 | 🟡 低 | 加随机后缀防冲突 |
| 10 | 事件更新后不排序 | 🟡 低 | update 路由加 `.sort()` |
| 11 | `multer@2.1.1` 非官方包 | 🟡 低 | 降级到 `multer@1.4.5-lts.1` |
| 12 | .DS_Store / .bak7 / .restore / ZIP 在 git 中 | 🟡 低 | `.gitignore` + `git rm` |
| 13 | `.playwright-mcp/` 480MB 开发产物 | 🟡 低 | `.gitignore` 排除 |
| 14 | 13 个中文文件名 | 🟡 低 | 保留不变（跨平台影响小） |
| 15 | README 过时 | 🟡 低 | 更新项目结构图 |
| 16 | 根目录测试截图未清理 | 🟡 低 | `.gitignore` 排除 |

## 架构

### 前端：IIFE 命名空间模块化

```
public/
├── index.html              # 纯 HTML 骨架 + <link>/<script> 引用
├── admin.html
├── calendar.html
├── css/
│   ├── main.css            # 从 index.html <style> 完整迁出
│   ├── splash.css          # V9.0 splash 样式（16行）
│   └── admin.css           # 从 admin.html <style> 完整迁出
├── js/
│   ├── app.js              # 页面入口：初始化所有模块
│   ├── utils.js            # 公共工具（hash、lerp、debounce 等）
│   ├── splash.js           # V9.0 Antigravity 引擎，暴露 window.Splash
│   ├── curriculum.js       # 课表渲染+编辑，暴露 window.Curriculum
│   ├── calendar.js         # 日历组件，暴露 window.Calendar
│   ├── gallery.js          # 奥林匹克相册，暴露 window.Gallery
│   ├── venues.js           # 场馆管理，暴露 window.Venues
│   └── parkour.js          # 早操跑酷，暴露 window.Parkour
└── assets/                 # 不变
```

**模块规范：**
- 每个 JS 文件 `!function(){'use strict' ...}()` IIFE 包裹
- 暴露一个 `window.Xxx` 命名空间，3-5 个公开方法
- 模块间不直接调用，通过 `app.js` 协调
- 加载顺序：utils → splash → 功能模块 → app（入口最后）

### 服务端：路由拆分 + 写入队列

```
server/
├── index.js                # 精简：路由挂载 + 启动（~40行）
├── store.js                # 统一数据访问层，Promise 链写入队列
├── config.js               # 配置外置，环境变量可覆盖
├── middleware/
│   ├── auth.js             # validateAdminSession
│   └── upload.js           # Multer 配置集中
├── routes/
│   ├── curriculum.js       # /api/curriculum
│   ├── gallery.js          # /api/gallery + /api/upload
│   ├── parkour.js          # /api/parkour + /api/upload-parkour*
│   ├── calendar.js         # /api/calendar
│   ├── venues.js           # /api/venues
│   └── admin.js            # /api/admin/login + change-password
└── data/                   # 7 个 JSON 文件（不变）
```

### store.js 写入安全

- `write(name, data)` 返回 Promise
- 同一文件的写入严格串行排队（Promise 链）
- 写临时文件 → rename 原子替换，崩溃不损坏数据
- `read(name)` 同步读（兼容现有调用模式）

### config.js — 配置外置 + 凭据脱敏

```javascript
// server/config.js
module.exports = {
  PORT: process.env.PORT || 3000,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'tsinglan_pe_secure_token_2026',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '123456',
  UPLOAD_MAX_SIZE: 200 * 1024 * 1024
};
```

默认值保留以兼容现有部署，但环境变量 `ADMIN_TOKEN` / `ADMIN_PASSWORD` 可覆盖。不再在 `admin_auth.json` 不存在时自动写入默认凭据到磁盘。

### 安全加固要点

**路径遍历修复：** DELETE /api/parkour-image 中校验 `imagePath` 解析后的绝对路径必须以 `public/` 目录为前缀，否则拒绝。

**速率限制：** 登录路由加内存计数，同一 IP 60 秒内最多 5 次尝试，超限返回 429。

**输入验证：** PUT /api/gallery/:id 改为白名单字段校验，只允许更新 `caption` 和 `date`。

**ID 生成：** `Date.now().toString(36) + Math.random().toString(36).slice(2,6)` 防毫秒级冲突。

**Multer 降级：** `multer@2.1.1`（非官方 fork）→ `multer@1.4.5-lts.1`（官方 LTS），API 兼容。

## `.gitignore` 设计

```
node_modules/
.DS_Store
*.bak*
*.restore
.playwright-mcp/
*.zip
*.dmg
splash-*.png
v6-*.png
v7-*.png
.env
```

执行 `git rm --cached -r node_modules/ .DS_Store *.bak* *.restore *.zip` 清理已追踪的无效文件（但保留工作区副本）。

## 不变项（零修改）

- 所有 HTML 的 DOM 结构和 CSS class 名
- 所有 CSS 选择器和规则值
- 所有 JS 函数逻辑和 API 调用
- 7 个 JSON 数据文件的格式和路径
- `npm start` 部署方式
- `logo.png` 路径和文件名
- `package.json` 中 express 和 cors 依赖不变（multer 版本降级但 API 兼容）

## 风险与控制

| 风险 | 控制措施 |
|---|---|
| `<script>` 加载顺序错误导致 `X is not defined` | 固定顺序：utils → 模块 → app，验证脚本加载 |
| CSS 选择器优先级因拆分改变 | 完整迁出，不改一行 CSS，`<link>` 顺序与原 `<style>` 顺序一致 |
| 服务端路由拆分后路径冲突 | 每个路由文件用 `express.Router()`，统一在 `index.js` 挂载 |
| 写入队列引入性能瓶颈 | 队列只按文件名串行，不同文件间并行；读操作不排队 |

## 验证

1. **Git 清理验证：** `find . -name '.DS_Store' | wc -l` 返回 0；`git ls-files node_modules/ | wc -l` 返回 0
2. 启动 `node server/index.js`，访问 `http://localhost:3000`
3. 逐一验证每个功能模块：splash 动画→课表展示→日历→相册→场馆→跑酷→管理后台
4. 用浏览器 DevTools 检查 console 无报错
5. 用 Playwright 截图对比重构前后的页面
6. **安全验证：** `curl -X POST http://localhost:3000/api/admin/login -d '{"password":"wrong"}'` 连续 6 次 → 第 6 次返回 429
7. **路径遍历验证：** `curl -X DELETE http://localhost:3000/api/parkour-image -H 'x-admin-token: ...' -d '{"imagePath":"../../../etc/passwd"}'` → 返回 400
8. **原子写入验证：** 模拟并发写入 → 数据不丢失
9. `git diff --stat` 确认：增 ~18 个新文件，3 个 HTML 大幅瘦身，node_modules 从追踪中移除
