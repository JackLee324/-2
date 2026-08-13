# 生产环境安全更新规范

> 目标：新功能可快速增加，旧功能不轻易被破坏；代码可更新，历史数据不被误删；问题能快速发现并安全回滚。

---

## 1. 当前系统架构分析

```
浏览器(原生 HTML/CSS/JS)
   │ fetch (x-admin-token header)
   ▼
Express 4.18 路由 (server/routes/*.js × 6)
   │  ├─ 请求 ID + 结构化日志 (logger.js)
   │  ├─ 写接口限流 (auth.rateLimitWrite)
   │  └─ 鉴权 (auth.validateAdminSession)
   ▼
store.js (数据层)
   ├─ mutate() 原子读改写（消除竞态）
   ├─ write()  原子写（临时文件+rename）
   └─ 写前自动备份 (backup.js)
   ▼
磁盘 JSON 文件 (server/data/*.json × 7)
磁盘上传文件 (public/assets/*)
```

**数据流**：前端 fetch → 路由鉴权/限流 → store 原子读写 → JSON 文件（写前自动快照）。

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | 原生 JS，无框架/无构建 | API 调用散落在 app.js/admin.js/calendar.js |
| 后端 | Express 4.18 | 6 个路由模块，try/catch 包裹 |
| 存储 | JSON 文件（非关系数据库） | 7 个文件，~50KB |
| 文件 | 本地磁盘 public/assets/ | multer 上传 |
| 认证 | 静态 token 比对 | 凭据持久化 admin_auth.json |
| 备份 | 写前快照 + 启动全量 | server/backup.js |
| 日志 | 结构化 JSON | server/logger.js |

---

## 2. 当前风险清单

| 级别 | 风险 | 状态 |
|------|------|------|
| P0 | 硬编码默认密码/token 入库 | ✅ 已修复（config 从 admin_auth.json 加载） |
| P0 | change-password 不持久化 | ✅ 已修复（写入 admin_auth.json） |
| P0 | read-modify-write 竞态丢数据 | ✅ 已修复（mutate 原子化） |
| P0 | admin_auth.json 死数据 | ✅ 已修复（config 读取它） |
| P1 | 无备份机制 | ✅ 已修复（backup.js 写前快照+启动全量） |
| P1 | 无 migration 管理 | 🟡 部分（auto-migrate + 版本日志，无正式框架） |
| P1 | venues 整表覆盖 | ✅ 已修复（结构校验） |
| P1 | 无结构化日志 | ✅ 已修复（logger.js + request-id） |
| P2 | 无参数验证框架 | 🟡 部分（手动校验，未引入框架） |
| P2 | 上传文件名碰撞 | ✅ 已修复（加随机后缀） |
| P2 | 除登录外无限流 | ✅ 已修复（写接口限流） |
| P2 | 健康检查不深 | ✅ 已修复（检测数据文件可读性） |
| P3 | 前端无全局错误边界 | ⬜ 未处理 |
| P3 | 无 CI/CD | ⬜ 未处理 |
| P3 | 无进程管理器 | ⬜ 未处理 |

---

## 3. 最优先修复的问题（已完成）

按优先级，本轮已完成：
1. **数据自动备份**（写前快照 + 启动全量）— 后续一切改动的安全兜底
2. **竞态修复**（mutate 原子读改写）— 消除并发丢数据
3. **认证持久化**（change-password 真正落盘，凭据从 admin_auth.json 加载）
4. **整表覆盖校验**（venues 结构校验）
5. **日志/监控**（结构化日志 + 请求 ID + 健康检查增强）

---

## 4. 数据安全方案

### 备份策略
- **写前快照**：每次 `store.write/mutate` 前，`backup.snapshotFile` 保存「修改前」状态到 `backups/<name>.<timestamp>.json`，每文件保留 20 份
- **启动全量**：`backup.snapshotAll` 在服务启动时快照整个 data 目录到 `backups/full.<timestamp>/`，保留 5 份
- **备份目录**：`backups/` 已加入 .gitignore，不随代码入库

### 恢复方法
```bash
# 恢复单个文件到修改前状态
cp backups/academic_calendar.<时间戳>.json server/data/academic_calendar.json

# 恢复整目录到某次启动基线
cp backups/full.<时间戳>/*.json server/data/
```

### Migration 原则（JSON 文件适用）
- 数据结构变化采用「**先增加、后兼容、再切换、最后清理**」
- `store.js` 的 `read()`/`readInMemory()` 自动补齐 `defaults` 中缺失的顶层字段（向后兼容），并记录 `auto-migrate` 日志
- 新增字段永不删除旧字段；字段类型变更前必须备份
- `SCHEMA_VERSION` 常量用于追踪结构版本

### 禁止操作
- ❌ 不直接 Drop / 清空数据文件
- ❌ 不因新增字段删除旧字段
- ❌ 不直接覆盖生产数据（整表覆盖接口已加结构校验）
- ✅ 大规模变更前先 `backup.snapshotAll`

---

## 5. 后端稳定性方案

| 能力 | 实现 | 位置 |
|------|------|------|
| 全局异常处理 | try/catch + 全局 error 中间件 | 各路由 + index.js |
| 统一错误响应 | `{ success, error }` 信封 | 所有路由 |
| 写接口限流 | 同一 IP 60s 120 次 | auth.rateLimitWrite |
| 登录限流 | 同一 IP 60s 5 次 | auth.rateLimitLogin |
| 参数验证 | 手动 if 校验 + 结构校验 | 各路由 |
| 鉴权 | x-admin-token 比对 | auth.validateAdminSession |
| 原子写 | 临时文件 + rename | store.writeRaw |
| 原子读改写 | mutate() 队列内读改写 | store.mutate |
| 队列防毒化 | 失败不阻塞后续写 | store.enqueue |
| 健康检查 | status + dataReadable | /api/health |
| 优雅关闭 | SIGTERM handler | index.js |
| 结构化日志 | JSON 行 + request-id | logger.js |

### 故障隔离
- 备份失败不阻断写（try/catch 包裹）
- 文件 unlink 失败不阻断响应（try/catch 包裹）
- 日志写入失败不阻断业务（try/catch 包裹）
- 队列单次失败不毒化队列

---

## 6. 发布方案

当前项目规模（单机 + JSON 文件），建议采用**轻量级发布流程**：

```
本地开发 → 测试(api.test.js) → 备份 → 部署 → 验证
```

| 步骤 | 操作 |
|------|------|
| 1. 测试 | `npm test`（15 项冒烟测试全绿才可部署） |
| 2. 备份 | 部署前 `cp -r server/data backups/` |
| 3. 部署 | 停旧进程 → 拉代码 → `node server/index.js` |
| 4. 验证 | `curl /api/health` 检查 status=ok + dataReadable=true |
| 5. 监控 | 观察 logs/app.log 无 error |

### 回滚
- **代码回滚**：`git revert <commit>` 或切回旧分支
- **数据回滚**：从 `backups/` 恢复（写前快照保证有「修改前」状态）
- **配置回滚**：env 变量 > admin_auth.json > 默认值，调整优先级即可

> 注意：代码可回滚，数据库（JSON）回滚依赖备份，因此**写前快照**是关键保障。

---

## 7. 更新安全规则

每次修改代码前，必须回答：
1. 会不会影响现有数据？→ 是则先备份
2. 会不会影响现有 API？→ 是则保持响应结构兼容
3. 会不会导致旧版本无法运行？→ 是则采用兼容策略
4. 是否需要数据迁移？→ 用 auto-migrate 补字段，不删旧字段
5. 能否回滚？→ 有备份 + git 提交即可回滚

### 铁律
1. 数据安全优先
2. 现有业务稳定优先
3. 可回滚优先
4. 小步迭代，不无必要大重构
5. 任何数据结构变化必须备份 + 兼容
6. 新功能必须兼容旧数据和旧业务
7. 每次修改都要考虑「如果失败怎么办」

---

## 8. 自动化检查

| 检查项 | 命令 | 频率 |
|--------|------|------|
| 语法检查 | `node --check <file>` | 每次修改后 |
| 冒烟测试 | `npm test` | 每次部署前 |
| 数据完整性 | `/api/health` dataReadable | 每次部署后 |
| 备份验证 | `ls backups/` | 定期 |

### 建议后续引入（P3）
- CI：GitHub Actions 跑 `npm test`
- 进程管理：PM2（崩溃自动重启）
- 前端全局错误边界 + loading/error/empty 状态统一

---

## 9. 最终目标

达成状态：
- ✅ **新功能快速增加**：路由模块化，新增路由文件即可
- ✅ **旧功能不被破坏**：15 项回归测试 + mutate 原子化
- ✅ **历史数据不误删**：写前自动快照 + 整表覆盖校验
- ✅ **问题快速发现**：结构化日志 + 请求 ID + 健康检查
- ✅ **安全回滚**：backups/ 快照 + git 提交

---

## 本轮改动清单

| 文件 | 改动 |
|------|------|
| `server/backup.js` | 新增：写前快照 + 启动全量备份 |
| `server/logger.js` | 新增：结构化 JSON 日志 |
| `server/store.js` | 增加 mutate() 原子读改写、备份接入、队列防毒化、SCHEMA_VERSION |
| `server/config.js` | 凭据从 admin_auth.json 加载（env 优先） |
| `server/index.js` | 启动快照、请求 ID 日志、写限流、健康检查增强 |
| `server/middleware/auth.js` | 增加通用限流工厂 rateLimitWrite |
| `server/middleware/upload.js` | 文件名加随机后缀防碰撞 |
| `server/routes/calendar.js` | 写操作改 mutate() |
| `server/routes/curriculum.js` | 写操作改 mutate() |
| `server/routes/gallery.js` | 写操作改 mutate()，unlink 加 try/catch |
| `server/routes/parkour.js` | 写操作改 mutate()，unlink 加 try/catch |
| `server/routes/venues.js` | 写操作改 mutate()，整表覆盖加结构校验 |
| `server/routes/admin.js` | change-password 持久化 |
| `.gitignore` | 忽略 backups/ 和 logs/ |

**验证结果**：15/15 冒烟测试通过；venue 校验返回 400；change-password 持久化生效；数据完整（5 预约 + 4 班级）。
