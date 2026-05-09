# Tsinglan Kindergarten PE Curriculum CMS

清澜山幼儿园体育课程体系内容管理系统（CMS）

---

## 快速启动

```bash
# 1. 进入项目目录
cd cms

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

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/curriculum` | 获取全部三个标签页数据 |
| `GET` | `/api/curriculum/:tab` | 获取指定标签页（`prek` / `k` / `climbing`）数据 |
| `PUT` | `/api/curriculum/:tab` | 替换指定标签页全部数据（数组） |
| `POST` | `/api/curriculum/:tab` | 添加一行 |
| `DELETE` | `/api/curriculum/:tab/:week` | 删除一行 |

---

## 项目结构

```
cms/
├── package.json              # 依赖配置
├── server/
│   ├── index.js               # Express 服务器（API + 静态文件服务）
│   └── data/
│       └── curriculum.json    # 课表数据存储（可手动编辑 / Git 追踪）
└── public/
    ├── index.html             # 公共展示页（保持原始高定 UI）
    └── admin.html             # 管理员后台（Tailwind CSS，CRUD 表单）
```

---

## 数据备份

课表数据存储在 `server/data/curriculum.json`，是一个普通 JSON 文件。

- **手动备份**：直接复制该文件即可
- **版本控制**：可提交到 Git，追踪每次课表修改历史

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | 本地 JSON 文件（零配置） |
| 前端展示 | 原生 HTML/CSS/JS + ECharts |
| 管理后台 | Tailwind CSS CDN |
| 跨域 | CORS（已配置） |

---

## 常见问题

**Q: 公共页显示"数据加载失败"？**
A: 确保后端服务已启动（`npm start`）。本地访问地址必须是 `http://localhost:3000`，不支持文件协议直接打开。

**Q: 如何修改 Sub-Unit 内容的渲染格式？**
A: 在 `public/index.html` 中搜索 `formatSubunit` 函数，可自定义解析规则。

**Q: 如何恢复原始数据？**
A: 删除 `server/data/curriculum.json`，重启服务器会自动生成默认数据。
