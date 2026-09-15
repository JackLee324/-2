# 部署与运维

> 项目位置：`~/Developer/cms`
> **不要移回 iCloud 同步目录（桌面 / 文稿）**，原因见文末「历史事故」。

---

## 一、启动与停止

### 手动启动

```bash
cd ~/Developer/cms
npm start
```

默认监听 `http://localhost:3000`，仅本机可访问。

### 停止

```bash
pkill -f "node server/index.js"
```

### 查看运行状态

```bash
# 进程是否在跑 + 启动时间
ps -o pid,lstart,etime,command -p "$(pgrep -f 'node server/index.js' | head -1)"

# 健康检查接口（含数据文件可读性）
curl -s http://localhost:3000/api/health

# 实时日志
tail -f ~/Developer/cms/logs/server.out
```

### 一键收尾验证（重启 + 全项检查）

```bash
bash ~/Developer/cms/scripts/finalize.sh
```

该脚本会依次完成：读取当前生效凭据 → 重启服务 → 检查 `/api/health` →
用凭据登录并比对 token → 逐个检查 5 个数据接口 → 逐个检查 14 个静态资源是否非空 →
跑巡检与冒烟测试，最后给出通过/失败计数与退出码。**改完凭据后用它可以一次性确认全部生效。**

---

## 二、开机自启（launchd）

macOS 原生方案，无需额外依赖（项目里原有的 `ecosystem.config.js` 是 PM2 方案，
可作为备选，见下一节）。

### 安装

> ⚠️ **先确认没有手动启动的服务在跑**。launchd 配置带 `RunAtLoad` + `KeepAlive`，
> 若 3000 端口已被占用，它启动的实例会因端口冲突退出并被反复拉起（每 10 秒一次）。
> 启动脚本已内置端口检查，冲突时会直接退出，但仍建议先停掉手动实例。

```bash
# 0. 停掉手动启动的实例
pkill -f "node server/index.js" || true

# 1. 给启动脚本执行权限
chmod +x ~/Developer/cms/scripts/start-server.sh

# 2. 安装 launchd 配置
cp ~/Developer/cms/scripts/com.tsinglan.pe-cms.plist ~/Library/LaunchAgents/

# 3. 加载（立即生效，并在以后开机时自动启动）
launchctl load ~/Library/LaunchAgents/com.tsinglan.pe-cms.plist
```

### 验证

```bash
launchctl list | grep pe-cms          # 第二列是 PID，第三列非 0 表示异常退出过
curl -s http://localhost:3000/api/health
```

### 重启服务

```bash
launchctl kickstart -k gui/$(id -u)/com.tsinglan.pe-cms
```

### 卸载

```bash
launchctl unload ~/Library/LaunchAgents/com.tsinglan.pe-cms.plist
rm ~/Library/LaunchAgents/com.tsinglan.pe-cms.plist
```

### 配置说明

| 配置项 | 作用 |
|---|---|
| `RunAtLoad` | 登录后自动启动 |
| `KeepAlive` | 进程退出（含崩溃）后自动拉起 |
| `ThrottleInterval` | 最短 10 秒重启一次，避免崩溃时疯狂刷日志 |
| `StandardOutPath` / `StandardErrorPath` | 日志写入 `logs/server.out` / `logs/server.err` |

> launchd 启动的进程不加载 `~/.zshrc`，因此找不到 nvm 管理的 node。
> `scripts/start-server.sh` 已显式引入 nvm，这就是它存在的原因。

---

## 三、备选：PM2

项目根目录保留了 `ecosystem.config.js`（PM2 方案，含内存超限自动重启）：

```bash
npm i -g pm2
cd ~/Developer/cms
pm2 start ecosystem.config.js
pm2 save              # 保存进程列表
pm2 startup           # 生成开机自启配置（按提示执行输出的命令）
```

两种方案**不要同时启用**，否则会争抢 3000 端口。

---

## 四、日常巡检

```bash
cd ~/Developer/cms
npm run healthcheck   # 存储层巡检：文件内容是否被抽走、数据能否正常读取
npm test              # API 冒烟测试（15 项，使用临时数据目录，不碰真实数据）
```

建议把巡检加入定时任务（每天一次）：

```bash
# 编辑 crontab
crontab -e

# 每天 9:00 巡检，异常时写日志
0 9 * * * cd ~/Developer/cms && npm run healthcheck >> logs/healthcheck.log 2>&1
```

---

## 五、数据备份与恢复

系统自带两层备份（`server/backup.js`）：

- **写前快照**：每次写数据前，把「修改前」的状态存到 `backups/<名称>.<时间戳>.json`，每文件保留 20 份
- **启动全量**：服务启动时快照整个 `server/data/` 到 `backups/full.<时间戳>/`，保留 5 份

两者都不会把 0 字节的空文件写成备份，避免备份链退化。

### 恢复

```bash
# 1. 找到可回滚的时间点
ls -lt ~/Developer/cms/backups/ | head -20

# 2. 回滚单个文件（示例：校历）
cp ~/Developer/cms/backups/academic_calendar.<时间戳>.json \
   ~/Developer/cms/server/data/academic_calendar.json

# 3. 回滚到某次启动时的完整基线
cp ~/Developer/cms/backups/full.<时间戳>/*.json ~/Developer/cms/server/data/
```

恢复后刷新页面即可，无需重启服务（数据是每次请求实时读取的）。

---

## 六、历史事故：iCloud 抽走文件内容（2026-09-15）

### 症状

- 页面**样式全丢、按钮失灵，但浏览器控制台没有任何报错**
- 接口 `/api/calendar` 返回 500 `Unexpected end of JSON input`
- 静态资源 `/js/admin.js`、`/css/main.css` 返回 **200 但 0 字节**

### 原因

项目原本位于 `~/Desktop/幼儿园/体育体系/cms`，而桌面开启了 iCloud
「桌面与文稿」同步，并启用了**「优化储存空间」**（`optimize-storage = 1`）。
macOS 把文件内容抽回云端，本地只留占位符（`dataless` 标志），
读取时内核拉取失败，进程收到 `EDEADLK`（文件系统死锁）而非普通权限错误。

当时代码目录中绝大多数文件处于该状态（1519 个文件中超过 1500 个），
包括 `.git/index` 和全部 git 对象。

### 为什么难以发现

Express 在文件读取失败时**静默结束了响应**：状态码 200、内容为空。
前端拿到的是一份空的 JS/CSS，表现为功能异常却不报错。

### 处置与预防

1. 用 `brctl download "<路径>"` 把文件内容逐个取回本地
2. 项目迁出 iCloud 同步目录 → `~/Developer/cms`（迁移时逐文件 SHA-256 校验，1519 个文件全部一致）
3. 新增 `npm run healthcheck`，提前发现内容被抽走
4. 代码层加固：数据文件读空时显式报错，不再静默返回空内容

> 若将来再次出现类似症状，先跑 `npm run healthcheck`。
