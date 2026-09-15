# Tsinglan Kindergarten PE Curriculum CMS

清澜山幼儿园体育课程体系内容管理系统（CMS）

---

## 快速启动

> **项目位置：`~/Developer/cms`**
> 请勿把本项目移回 iCloud 同步目录（桌面 / 文稿）。iCloud 的"优化储存空间"
> 会把文件内容抽回云端只留占位符，导致页面样式与数据静默失效（接口返回 200 但内容为空）。
> 该问题已于 2026-09-15 排查并修复，项目已迁出同步目录。

```bash
# 1. 进入项目目录
cd ~/Developer/cms

# 2. 安装依赖（仅需 Node.js，无需数据库）
npm install

# 3. 启动服务器
npm start
```

启动成功后会看到：

```
🏅 Tsinglan PE CMS running at http://localhost:3000
📋 Public page:  http://localhost:3000/
⚙️  Admin panel: http://localhost:3000/admin
📁 Data file:   /.../cms/server/data/curriculum.json
```

### 日常运维命令

```bash
npm start        # 启动服务
npm test         # API 冒烟测试（15 项，使用临时数据目录，不碰真实数据）
npm run healthcheck   # 存储层巡检：文件内容是否被抽走、数据能否正常读取
```

**建议**：网站出现"样式丢失 / 按钮失灵但没有任何报错"时，先跑
`npm run healthcheck`。这类静默故障的特征是文件大小正常但内容读不出来，
不会在前端报错，巡检能在你察觉之前发现。

---

## 功能说明

### 公共展示页 (`http://localhost:3000/`)

- 展示完整 38 周课程表（PreK / K / Climbing & Swimming 三个标签页）
- Sub-Unit 内容支持富文本分段渲染（▸ 加粗标题 + 灰色描述）
- 全部 UI 样式（阴影、圆角、配色、字体）均与原版完全一致
- 无后端时自动降级显示静态数据

### 管理员后台 (`http://localhost:3000/admin`)

- 增删改课表任意行（支持普通数据行 / 假期行 / 学期标题行三种类型）
- Sub-Unit 编辑说明：
  - **单行**：`I Can Run`
  - **标题+描述**：`I Can Run (Focus on sprint mechanics)`
  - **多行分段**：每行输入一条，格式同上
- 保存后**刷新公共页即可看到更新**

### API 接口

**课表管理**
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/curriculum` | 获取全部标签页数据 |
| `GET` | `/api/curriculum/:tab` | 获取指定标签页（`prek` / `k` / `climbing`） |
| `PUT` | `/api/curriculum/:tab` | 替换指定标签页全部数据 |
| `POST` | `/api/curriculum/:tab` | 添加一行 |
| `DELETE` | `/api/curriculum/:tab/:week` | 删除一行 |

**奥林匹克相册**
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/gallery` | 获取全部相册项目 |
| `POST` | `/api/upload` | 上传图片/视频（需登录） |
| `PUT` | `/api/gallery/:id` | 更新标题/日期（需登录） |
| `DELETE` | `/api/gallery/:id` | 删除项目（需登录） |

**早操跑酷**
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/parkour` | 获取跑酷数据 |
| `PUT` | `/api/parkour` | 更新跑酷数据（需登录） |
| `GET` | `/api/parkour-videos` | 获取跑酷视频列表 |
| `POST` | `/api/upload-parkour` | 上传跑酷图片（需登录） |
| `POST` | `/api/upload-parkour-video` | 上传跑酷视频（需登录） |
| `DELETE` | `/api/parkour-image` | 删除跑酷图片（需登录） |
| `DELETE` | `/api/parkour-video/:id` | 删除跑酷视频（需登录） |

**校历**
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/calendar` | 获取校历数据 |
| `GET` | `/api/time` | 获取服务器时间 |
| `POST` | `/api/calendar/event` | 添加事件（需登录） |
| `PUT` | `/api/calendar/event/:id` | 更新事件（需登录） |
| `DELETE` | `/api/calendar/event/:id` | 删除事件（需登录） |
| `PUT` | `/api/calendar/themes` | 更新月主题（需登录） |
| `PUT` | `/api/calendar/notice` | 更新全局通知（需登录） |

**场馆管理**
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/venues` | 获取场馆数据 |
| `PUT` | `/api/venues/core/:id` | 更新核心场馆（需登录） |
| `PUT` | `/api/venues/aux/:id` | 更新辅助场馆（需登录） |
| `DELETE` | `/api/venues/aux/:id` | 删除辅助场馆（需登录） |
| `PUT` | `/api/venues` | 批量更新场馆（需登录） |
| `POST` | `/api/venues` | 批量更新场馆（需登录） |
| `POST` | `/api/upload-venue` | 上传场馆图片（需登录） |

**管理员认证**
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/login` | 登录（速率限制：60s内5次） |
| `POST` | `/api/admin/change-password` | 修改密码（需登录） |

---

## 项目结构

```
cms/
├── package.json                # 依赖配置
├── .gitignore                  # Git 忽略规则
├── server/
│   ├── index.js                # Express 入口（~45行，路由挂载）
│   ├── config.js               # 配置外置（环境变量可覆盖）
│   ├── store.js                # 统一数据访问层（原子写入队列）
│   ├── middleware/
│   │   ├── auth.js             # 管理员鉴权 + 登录速率限制
│   │   └── upload.js           # Multer 上传配置集中管理
│   ├── routes/
│   │   ├── curriculum.js       # /api/curriculum 课表 CRUD
│   │   ├── gallery.js          # /api/gallery 奥林匹克相册
│   │   ├── parkour.js          # /api/parkour 早操跑酷
│   │   ├── calendar.js         # /api/calendar 校历事件
│   │   ├── venues.js           # /api/venues 场馆管理
│   │   └── admin.js            # /api/admin 登录 + 改密
│   └── data/                   # 7 个 JSON 数据文件
│       ├── curriculum.json
│       ├── olympic_gallery.json
│       ├── morning_parkour.json
│       ├── parkour_videos.json
│       ├── academic_calendar.json
│       ├── campus_venues.json
│       └── admin_auth.json
└── public/
    ├── index.html              # 公共展示页（HTML 骨架 + 外部引用）
    ├── admin.html              # 管理员后台
    ├── calendar.html           # 校历页面
    ├── splash.html             # 启动页
    ├── css/
    │   ├── main.css            # 主样式（3246行，从 index.html 迁出）
    │   ├── splash.css          # V9.0 启动动画样式
    │   └── admin.css           # 管理后台样式（890行）
    ├── js/
    │   ├── app.js              # 主应用逻辑（1155行）
    │   ├── splash.js           # V9.0 Antigravity 引擎（138行 IIFE）
    │   ├── admin.js            # 管理后台逻辑（1413行）
    │   ├── admin-venues.js     # 场馆管理逻辑（262行）
    │   └── calendar.js         # 校历页面逻辑（514行）
    └── assets/                 # 上传资源（图片、视频）
```

---

## 数据备份

所有数据存储在 `server/data/` 目录下的 7 个 JSON 文件中。

- **手动备份**：直接复制 `server/data/` 整个目录即可
- **版本控制**：可提交到 Git，追踪每次数据修改历史
- **原子写入**：所有写操作采用临时文件 + rename 模式，崩溃不损坏数据

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express 4.x |
| 路由 | Express Router 模块化（6 个路由文件） |
| 存储 | 本地 JSON 文件 + 原子写入队列 |
| 认证 | Token 鉴权（环境变量可覆盖） + 登录速率限制 |
| 上传 | Multer 1.4.5-lts.1（200MB 图片/视频） |
| 前端 | 原生 HTML/CSS/JS（ES5 IIFE 模块化） + ECharts 5.4 |
| 管理后台 | Tailwind CSS CDN |
| 跨域 | CORS（已配置） |

## 环境变量（可选）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务器端口 |
| `ADMIN_TOKEN` | 读取 `server/data/admin_auth.json` | 管理员鉴权 Token |
| `ADMIN_PASSWORD` | 读取 `server/data/admin_auth.json` | 管理员登录密码 |
| `DATA_DIR` | `server/data` | 数据目录（测试用，可不设） |

**凭据说明（重要）**

- 凭据**只**存放在 `server/data/admin_auth.json`，该文件已加入 `.gitignore`，不会入库。
- 优先级：环境变量 > `admin_auth.json` > 首次启动自动生成随机强凭据。
- 代码中**没有任何硬编码默认口令**：若凭据文件缺失或损坏，服务会自动生成一组
  随机凭据写入该文件，并把新密码打印在启动日志中（不再静默降级为弱口令）。
- 修改密码：登录后台 → 「⚙️ 安全设置」。修改后会同时更新 `admin_auth.json` 中的
  密码与 Token，原有 Token 立即失效。

## 安全加固

- **路径遍历防护**：DELETE /api/parkour-image 校验路径必须在 `public/` 目录内
- **速率限制**：登录接口同 IP 60 秒内最多 5 次尝试；写接口 60 秒内最多 120 次
- **输入验证**：PUT /api/gallery/:id 白名单字段（仅 `caption`、`date`）
- **原子写入**：所有 JSON 写操作采用临时文件 + rename，崩溃不丢数据
- **凭据不入库**：`admin_auth.json` 由 `.gitignore` 排除；历史提交中出现过的旧凭据
  已于 2026-09-15 轮换
- **空数据防线**：数据文件读出空内容时显式报错，不会被当成空数据回写覆盖真实内容；
  空文件也不会进入备份快照

---

## 常见问题

**Q: 公共页显示"数据加载失败"？**
A: 确保后端服务已启动（`npm start`）。本地访问地址必须是 `http://localhost:3000`，不支持文件协议直接打开。

**Q: 如何修改 Sub-Unit 内容的渲染格式？**
A: 在 `public/index.html` 中搜索 `formatSubunit` 函数，可自定义解析规则。

**Q: 如何恢复原始数据？**
A: 删除 `server/data/curriculum.json`，重启服务器会自动生成默认数据。

**Q: 忘记后台密码了？**
A: 直接查看 `server/data/admin_auth.json` 里的 `adminPassword` 字段。
若想重新生成一组随机强密码，删除该文件后重启服务，新密码会打印在启动日志中。

**Q: 页面样式丢失、按钮点不动，但没有任何报错？**
A: 这是典型的"静默故障"，先跑 `npm run healthcheck`。
最常见原因是项目被放进了 iCloud 同步目录，文件内容被抽回云端。
按巡检输出里的提示执行 `brctl download "<文件路径>"` 即可取回，
并把项目移出同步目录（当前已在 `~/Developer/cms`，请保持）。

**Q: 数据被误改了，怎么回滚？**
A: 每次写操作前都会自动快照到 `backups/`（每文件保留 20 份，启动时另存全量快照 5 份）。

```bash
# 看有哪些可回滚的时间点
ls -lt ~/Developer/cms/backups/ | head

# 回滚单个文件到某个时间点
cp ~/Developer/cms/backups/academic_calendar.<时间戳>.json \
   ~/Developer/cms/server/data/academic_calendar.json
```
