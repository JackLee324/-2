# 项目结构重构 — 零功能变更的可迭代性优化

## 背景

当前项目 3 个 HTML 文件均为单体文件（index.html 5972 行/242KB、admin.html 3242 行/154KB、calendar.html 1392 行/50KB），CSS 和 JS 全部内联。服务端 index.js 865 行，包含所有路由、中间件、multer 配置和数据访问逻辑。全局变量冲突、同步文件 IO 并发不安全、零测试覆盖。

目标：在不改变任何 UI 内容、操作逻辑、部署方式的前提下，拆分文件、引入功能域隔离、加固服务端数据写入安全。

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

## 不变项（零修改）

- 所有 HTML 的 DOM 结构和 CSS class 名
- 所有 CSS 选择器和规则值
- 所有 JS 函数逻辑和 API 调用
- 7 个 JSON 数据文件的格式和路径
- `package.json` 依赖和 `npm start` 部署方式
- `logo.png` 路径和文件名

## 风险与控制

| 风险 | 控制措施 |
|---|---|
| `<script>` 加载顺序错误导致 `X is not defined` | 固定顺序：utils → 模块 → app，验证脚本加载 |
| CSS 选择器优先级因拆分改变 | 完整迁出，不改一行 CSS，`<link>` 顺序与原 `<style>` 顺序一致 |
| 服务端路由拆分后路径冲突 | 每个路由文件用 `express.Router()`，统一在 `index.js` 挂载 |
| 写入队列引入性能瓶颈 | 队列只按文件名串行，不同文件间并行；读操作不排队 |

## 验证

1. 启动 `node server/index.js`，访问 `http://localhost:3000`
2. 逐一验证每个功能模块：splash 动画→课表展示→日历→相册→场馆→跑酷→管理后台
3. 用浏览器 DevTools 检查 console 无报错
4. 用 Playwright 截图对比重构前后的页面
5. `git diff --stat` 确认文件数变化：增 ~15 个新文件，3 个 HTML 大幅瘦身
