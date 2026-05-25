# 项目结构重构 + 安全加固 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 3 个单体 HTML（~11,500 行）+ 1 个 865 行服务端文件拆分为 ~18 个模块化文件，修复 16 项审查发现的安全/质量问题，零功能、UI、部署变更。

**Architecture:** 服务端按路由拆分（Express Router）+ 统一原子写入层（store.js）；前端 IIFE 命名空间模块化（window.Xxx），CSS 外置为 `<link>` 引用。

**Tech Stack:** Express 4.x, vanilla JS (ES5 IIFE), Multer 1.4.5-lts.1, JSON 文件存储

---

### Task 1: Git 卫生 — .gitignore + 清理追踪垃圾

**Files:**
- Create: `.gitignore`
- Modify: git index（`git rm --cached`）

**涵盖的审查问题：** #1（无 .gitignore）、#12（.DS_Store/.bak7/.restore/ZIP）、#13（.playwright-mcp/）、#16（测试截图）

- [ ] **Step 1: 创建 .gitignore**

```gitignore
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

- [ ] **Step 2: 从 Git 追踪中移除无效文件**

```bash
git rm --cached -r node_modules/ 2>/dev/null
git rm --cached .DS_Store docs/.DS_Store public/.DS_Store public/assets/.DS_Store public/photos/.DS_Store server/.DS_Store 2>/dev/null
git rm --cached server/index.js.bak7 server/index.js.v7.restore public/index.html.bak7 public/index.html.bak7.restore 2>/dev/null
git rm --cached Qinglanshan_PE_CMS_V5_Backup.zip 2>/dev/null
```

- [ ] **Step 3: 提交**

```bash
git add .gitignore
git commit -m "chore: add .gitignore and remove tracked build artifacts"
```

---

### Task 2: Multer 降级 — 非官方 fork → 官方 LTS

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`（由 npm install 自动更新）

**涵盖的审查问题：** #11（multer@2.1.1 非官方包）

- [ ] **Step 1: 更新 package.json 版本号**

```diff
-    "multer": "^2.1.1"
+    "multer": "^1.4.5-lts.1"
```

- [ ] **Step 2: 重装依赖**

```bash
rm -rf node_modules package-lock.json
npm install
```

- [ ] **Step 3: 验证 API 兼容性**

`multer@1.4.5-lts.1` 与 `2.1.1` 在 `diskStorage`、`.single()`、`.fields()` 等 API 上完全兼容。检查 `require('multer')` 调用方式不变，`server/index.js` 中无需修改。

- [ ] **Step 4: 提交**

```bash
git add package.json package-lock.json
git commit -m "fix: downgrade multer to official 1.4.5-lts.1"
```

---

### Task 3: 服务端基础设施 — store.js + config.js + middleware/

**Files:**
- Create: `server/store.js`
- Create: `server/config.js`
- Create: `server/middleware/auth.js`
- Create: `server/middleware/upload.js`

**涵盖的审查问题：** #2（凭据外置）、#4（原子写入）

- [ ] **Step 1: 创建 server/config.js**

```javascript
// server/config.js — 所有配置集中管理，环境变量可覆盖
module.exports = {
  PORT: process.env.PORT || 3000,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'tsinglan_pe_secure_token_2026',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '123456',
  UPLOAD_MAX_SIZE: 200 * 1024 * 1024,
  FIELD_UPLOAD_MAX_SIZE: 5 * 1024 * 1024,
  PARKOUR_VIDEO_MAX_SIZE: 500 * 1024 * 1024
};
```

- [ ] **Step 2: 创建 server/store.js — 原子写入数据访问层**

```javascript
// server/store.js — 统一 JSON 数据读写，Promise 链原子写入
var fs = require('fs');
var path = require('path');
var DATA_DIR = path.join(__dirname, 'data');

var defaults = {
  curriculum: { prek: [], k: [], climbing: [] },
  olympic_gallery: [],
  morning_parkour: [],
  parkour_videos: [],
  academic_calendar: { monthlyThemes: [], events: [], globalNotice: { isActive: false, type: 'info', content: '' } },
  campus_venues: { coreVenues: [], auxVenues: [], rules: { equipmentReturn: '', bikeParking: '' } },
  admin_auth: { adminPassword: '123456', adminToken: 'tsinglan_pe_secure_token_2026' }
};

var queues = {};

function file(name) {
  return path.join(DATA_DIR, name + '.json');
}

function read(name) {
  var f = file(name);
  var dir = path.dirname(f);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(f)) {
    var d = defaults[name] || {};
    fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(d));
  }
  var raw = fs.readFileSync(f, 'utf8');
  var data = JSON.parse(raw);
  // 向后兼容：确保 globalNotice 存在
  if (name === 'academic_calendar') {
    if (!data.globalNotice) data.globalNotice = { isActive: false, type: 'info', content: '' };
    if (!data.monthlyThemes) data.monthlyThemes = [];
    if (!data.events) data.events = [];
  }
  return data;
}

function write(name, data) {
  var f = file(name);
  return new Promise(function (resolve, reject) {
    if (!queues[name]) queues[name] = Promise.resolve();
    queues[name] = queues[name].then(function () {
      return new Promise(function (res, rej) {
        var tmp = f + '.tmp.' + Date.now() + '.' + Math.random().toString(36).slice(2, 8);
        var dir = path.dirname(f);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8', function (err) {
          if (err) return rej(err);
          fs.rename(tmp, f, function (err2) {
            if (err2) return rej(err2);
            res();
          });
        });
      });
    }).catch(function (err) {
      console.error('[store] Write failed for ' + name + ':', err.message);
      throw err;
    }).then(function () { return undefined; });
    return queues[name];
  });
}

module.exports = { read: read, write: write };
```

- [ ] **Step 3: 创建 server/middleware/auth.js**

```javascript
// server/middleware/auth.js
var config = require('../config');

function validateAdminSession(req, res, next) {
  var token = req.headers['x-admin-token'];
  if (!token || token !== config.ADMIN_TOKEN) {
    return res.status(401).json({ success: false, error: '未授权访问，请重新登录' });
  }
  next();
}

// 简易内存速率限制：同一 IP 60s 内最多 5 次
var loginAttempts = {};
var RATE_LIMIT_WINDOW = 60000;
var RATE_LIMIT_MAX = 5;

function rateLimitLogin(req, res, next) {
  var ip = req.ip || req.connection.remoteAddress || 'unknown';
  var now = Date.now();
  if (!loginAttempts[ip]) loginAttempts[ip] = [];
  loginAttempts[ip] = loginAttempts[ip].filter(function (t) { return now - t < RATE_LIMIT_WINDOW; });
  if (loginAttempts[ip].length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, error: '登录尝试过于频繁，请60秒后再试' });
  }
  loginAttempts[ip].push(now);
  next();
}

// 定期清理过期记录（每 5 分钟）
setInterval(function () {
  var now = Date.now();
  Object.keys(loginAttempts).forEach(function (ip) {
    loginAttempts[ip] = loginAttempts[ip].filter(function (t) { return now - t < RATE_LIMIT_WINDOW; });
    if (loginAttempts[ip].length === 0) delete loginAttempts[ip];
  });
}, 300000);

module.exports = { validateAdminSession: validateAdminSession, rateLimitLogin: rateLimitLogin };
```

- [ ] **Step 4: 创建 server/middleware/upload.js**

```javascript
// server/middleware/upload.js — Multer 配置集中管理
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var config = require('../config');

var PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function makeStorage(subdir, prefix) {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      var dir = path.join(PUBLIC_DIR, 'assets', subdir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname).toLowerCase();
      cb(null, prefix + Date.now() + ext);
    }
  });
}

var galleryStorage = makeStorage('olympic', '');
var parkourStorage = makeStorage('parkour', '');
var videoStorage = makeStorage('parkour-videos', '');
var fieldStorage = makeStorage('fields', 'field_');

var uploadGallery = multer({
  storage: galleryStorage,
  limits: { fileSize: config.UPLOAD_MAX_SIZE },
  fileFilter: function (req, file, cb) {
    var allowed = /\.(jpeg|jpg|png|webp|gif|heic|heif|mp4|mov|webm|avi|mkv)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('不支持的文件类型: ' + file.originalname));
  }
});

var uploadParkourImage = multer({
  storage: parkourStorage,
  limits: { fileSize: config.UPLOAD_MAX_SIZE },
  fileFilter: function (req, file, cb) {
    var allowed = /\.(jpeg|jpg|png|webp|gif|heic|heif)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('跑酷只支持图片文件'));
  }
});

var uploadParkourVideo = multer({
  storage: videoStorage,
  limits: { fileSize: config.PARKOUR_VIDEO_MAX_SIZE },
  fileFilter: function (req, file, cb) {
    var allowed = /\.(mp4|webm|mov|avi|mkv)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('只支持视频文件 (mp4, webm, mov)'));
  }
});

var uploadField = multer({
  storage: fieldStorage,
  limits: { fileSize: config.FIELD_UPLOAD_MAX_SIZE },
  fileFilter: function (req, file, cb) {
    var allowed = /\.(jpg|jpeg|png|webp)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('场地只支持图片文件 (jpg, jpeg, png, webp)'));
  }
});

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: '文件大小超过限制' });
    return res.status(400).json({ success: false, error: '上传错误: ' + err.message });
  }
  if (err) return res.status(400).json({ success: false, error: err.message });
  next();
}

module.exports = {
  uploadGallery: uploadGallery,
  uploadParkourImage: uploadParkourImage,
  uploadParkourVideo: uploadParkourVideo,
  uploadField: uploadField,
  handleMulterError: handleMulterError
};
```

- [ ] **Step 5: 提交**

```bash
git add server/config.js server/store.js server/middleware/
git commit -m "feat: add server infrastructure — store, config, auth, upload middleware"
```

---

### Task 4: 服务端路由拆分 — 6 个 Router 文件

**Files:**
- Create: `server/routes/curriculum.js`
- Create: `server/routes/gallery.js`
- Create: `server/routes/parkour.js`
- Create: `server/routes/calendar.js`
- Create: `server/routes/venues.js`
- Create: `server/routes/admin.js`

- [ ] **Step 1: 创建 server/routes/curriculum.js**

从 `server/index.js` 第 210-309 行提取所有 `/api/curriculum` 路由。关键变更：使用 `store.read('curriculum')` / `store.write('curriculum', data)` 替代 `readData()` / `writeData()`。

```javascript
// server/routes/curriculum.js
var express = require('express');
var router = express.Router();
var store = require('../store');
var auth = require('../middleware/auth');

var VALID_TABS = ['prek', 'k', 'climbing'];

// GET /api/curriculum
router.get('/curriculum', function (req, res) {
  try {
    var data = store.read('curriculum');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/curriculum/:tab
router.get('/curriculum/:tab', function (req, res) {
  try {
    var tab = req.params.tab;
    if (!VALID_TABS.includes(tab)) {
      return res.status(400).json({ success: false, error: 'Invalid tab. Use: prek, k, climbing' });
    }
    var data = store.read('curriculum');
    res.json({ success: true, data: data[tab] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/curriculum/:tab
router.put('/curriculum/:tab', auth.validateAdminSession, function (req, res) {
  try {
    var tab = req.params.tab;
    if (!VALID_TABS.includes(tab)) {
      return res.status(400).json({ success: false, error: 'Invalid tab' });
    }
    var rows = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, error: 'Body must be an array of rows' });
    }
    var data = store.read('curriculum');
    data[tab] = rows;
    store.write('curriculum', data);
    res.json({ success: true, message: tab + ' updated with ' + rows.length + ' rows' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/curriculum/:tab
router.post('/curriculum/:tab', auth.validateAdminSession, function (req, res) {
  try {
    var tab = req.params.tab;
    if (!VALID_TABS.includes(tab)) {
      return res.status(400).json({ success: false, error: 'Invalid tab. Use: prek, k, climbing' });
    }
    var newRow = req.body;
    if (!newRow || !newRow.week || !newRow.month || !newRow.unit || !newRow.subunit) {
      return res.status(400).json({ success: false, error: 'Missing required fields: week, month, unit, subunit' });
    }
    var data = store.read('curriculum');
    var cleanRow = {
      week: String(newRow.week),
      month: String(newRow.month),
      unit: String(newRow.unit),
      subunit: String(newRow.subunit || ''),
      wd: String(newRow.wd || ''),
      events: String(newRow.events || ''),
      bgColor: String(newRow.bgColor || ''),
      textColor: String(newRow.textColor || '')
    };
    if (newRow.holiday) cleanRow.holiday = String(newRow.holiday);
    if (newRow.semester) cleanRow.semester = String(newRow.semester);
    data[tab].push(cleanRow);
    store.write('curriculum', data);
    res.json({ success: true, row: cleanRow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/curriculum/:tab/:week
router.delete('/curriculum/:tab/:week', auth.validateAdminSession, function (req, res) {
  try {
    var tab = req.params.tab;
    var week = req.params.week;
    if (!VALID_TABS.includes(tab)) {
      return res.status(400).json({ success: false, error: 'Invalid tab' });
    }
    var data = store.read('curriculum');
    var idx = data[tab].findIndex(function (row) {
      return row.week === week || (row.holiday && row.holiday === week) || (row.semester && row.semester === week);
    });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Row not found' });
    }
    var deleted = data[tab].splice(idx, 1)[0];
    store.write('curriculum', data);
    res.json({ success: true, deleted: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: 创建 server/routes/gallery.js**

从 `server/index.js` 第 313-399 行提取。**修复 #7：PUT /api/gallery/:id 加白名单验证。**

```javascript
// server/routes/gallery.js
var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var store = require('../store');
var auth = require('../middleware/auth');
var upload = require('../middleware/upload');

// GET /api/gallery
router.get('/gallery', function (req, res) {
  try {
    var items = store.read('olympic_gallery');
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload
router.post('/upload', auth.validateAdminSession, upload.uploadGallery.single('file'), upload.handleMulterError, function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file received' });
    }
    var isVideo = /mp4|mov|webm/i.test(path.extname(req.file.originalname));
    var item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      filename: req.file.filename,
      originalName: req.file.originalname,
      type: isVideo ? 'video' : 'image',
      caption: req.body.caption || '',
      date: req.body.date || '',
      uploadedAt: new Date().toISOString()
    };
    var gallery = store.read('olympic_gallery');
    gallery.unshift(item);
    store.write('olympic_gallery', gallery);
    res.json({ success: true, item: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/gallery/:id — 修复 #7：白名单字段校验
router.put('/gallery/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var gallery = store.read('olympic_gallery');
    var idx = gallery.findIndex(function (item) { return item.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    // 白名单：只允许更新 caption 和 date
    var allowed = { caption: true, date: true };
    var updates = {};
    Object.keys(req.body).forEach(function (key) {
      if (allowed[key]) updates[key] = String(req.body[key]);
    });
    gallery[idx] = Object.assign({}, gallery[idx], updates, { id: id });
    store.write('olympic_gallery', gallery);
    res.json({ success: true, item: gallery[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/gallery/:id
router.delete('/gallery/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var gallery = store.read('olympic_gallery');
    var idx = gallery.findIndex(function (item) { return item.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    var deleted = gallery.splice(idx, 1)[0];
    store.write('olympic_gallery', gallery);
    var filePath = path.join(__dirname, '..', '..', 'public', 'assets', 'olympic', deleted.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true, deleted: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: 创建 server/routes/parkour.js**

从 `server/index.js` 第 443-555 行提取。**修复 #3：DELETE /api/parkour-image 路径遍历校验。**

```javascript
// server/routes/parkour.js
var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var store = require('../store');
var auth = require('../middleware/auth');
var upload = require('../middleware/upload');

var PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// GET /api/parkour
router.get('/parkour', function (req, res) {
  try {
    var data = store.read('morning_parkour');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/parkour
router.put('/parkour', auth.validateAdminSession, function (req, res) {
  try {
    var rows = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, error: 'Body must be an array of parkour rows' });
    }
    store.write('morning_parkour', rows);
    res.json({ success: true, message: 'Parkour updated with ' + rows.length + ' rows' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload-parkour
router.post('/upload-parkour', auth.validateAdminSession, upload.uploadParkourImage.single('trackImage'), upload.handleMulterError, function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    res.json({
      success: true,
      imagePath: '/assets/parkour/' + req.file.filename,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/parkour-image — 修复 #3：路径遍历校验
router.delete('/parkour-image', auth.validateAdminSession, function (req, res) {
  try {
    var imagePath = req.body.imagePath;
    if (!imagePath) return res.status(400).json({ success: false, error: 'imagePath required' });
    // 规范化路径并校验必须在 public 目录内
    var resolved = path.resolve(PUBLIC_DIR, '.' + imagePath.replace(/\\/g, '/'));
    if (resolved.indexOf(path.resolve(PUBLIC_DIR)) !== 0) {
      return res.status(400).json({ success: false, error: 'Invalid image path' });
    }
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/parkour-videos
router.get('/parkour-videos', function (req, res) {
  try {
    var data = store.read('parkour_videos');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload-parkour-video
router.post('/upload-parkour-video', auth.validateAdminSession, upload.uploadParkourVideo.single('videoFile'), upload.handleMulterError, function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file received' });
    }
    var title = req.body.title;
    var description = req.body.description;
    var item = {
      id: 'pvid' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title || '未命名视频',
      description: description || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      uploadTime: new Date().toISOString()
    };
    var videos = store.read('parkour_videos');
    videos.unshift(item);
    store.write('parkour_videos', videos);
    res.json({ success: true, item: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/parkour-video/:id
router.delete('/parkour-video/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var videos = store.read('parkour_videos');
    var idx = videos.findIndex(function (v) { return v.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    var deleted = videos.splice(idx, 1)[0];
    store.write('parkour_videos', videos);
    var fullPath = path.join(PUBLIC_DIR, 'assets', 'parkour-videos', deleted.filename);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    res.json({ success: true, deleted: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: 创建 server/routes/calendar.js**

从 `server/index.js` 第 557-712 行提取。**修复 #10：事件更新后排序。**

```javascript
// server/routes/calendar.js
var express = require('express');
var router = express.Router();
var store = require('../store');
var auth = require('../middleware/auth');

var EVENT_TYPE_COLORS = {
  ParentEvent:   { bg: '#9B59B6', text: '#ffffff' },
  SchoolDay:     { bg: '#F1C40F', text: '#333333' },
  OnCampusEvent: { bg: '#E91E8C', text: '#ffffff' },
  PDDay:         { bg: '#95A5A6', text: '#ffffff' },
  Holiday:       { bg: '#27AE60', text: '#ffffff' }
};

var VALID_TYPES = Object.keys(EVENT_TYPE_COLORS);
var VALID_NOTICE_TYPES = ['danger', 'info', 'success'];

// GET /api/calendar
router.get('/calendar', function (req, res) {
  try {
    var data = store.read('academic_calendar');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/time
router.get('/time', function (req, res) {
  var now = new Date();
  res.json({
    success: true,
    time: now.toISOString(),
    timestamp: now.getTime()
  });
});

// POST /api/calendar/event
router.post('/calendar/event', auth.validateAdminSession, function (req, res) {
  try {
    var date = req.body.date, endDate = req.body.endDate, title = req.body.title;
    var titleEn = req.body.titleEn, type = req.body.type, description = req.body.description;
    var backgroundColor = req.body.backgroundColor, textColor = req.body.textColor;
    if (!date || !title || !type) {
      return res.status(400).json({ success: false, error: 'date, title, and type are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type. Use: ' + VALID_TYPES.join(', ') });
    }
    var cal = store.read('academic_calendar');
    var newEvent = {
      id: 'evt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: date,
      endDate: endDate || date,
      title: title || '',
      titleEn: titleEn || '',
      type: type,
      description: description || '',
      backgroundColor: backgroundColor || EVENT_TYPE_COLORS[type].bg || '#999999',
      textColor: textColor || EVENT_TYPE_COLORS[type].text || '#ffffff'
    };
    cal.events.push(newEvent);
    cal.events.sort(function (a, b) { return a.date.localeCompare(b.date); });
    store.write('academic_calendar', cal);
    res.json({ success: true, event: newEvent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/event/:id — 修复 #10：更新后排序
router.put('/calendar/event/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var cal = store.read('academic_calendar');
    var idx = cal.events.findIndex(function (e) { return e.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    if (req.body.type && !VALID_TYPES.includes(req.body.type)) {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }
    cal.events[idx] = Object.assign({}, cal.events[idx], req.body, { id: id });
    cal.events.sort(function (a, b) { return a.date.localeCompare(b.date); });
    store.write('academic_calendar', cal);
    res.json({ success: true, event: cal.events[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/calendar/event/:id
router.delete('/calendar/event/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var cal = store.read('academic_calendar');
    var idx = cal.events.findIndex(function (e) { return e.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    var deleted = cal.events.splice(idx, 1)[0];
    store.write('academic_calendar', cal);
    res.json({ success: true, deleted: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/themes
router.put('/calendar/themes', auth.validateAdminSession, function (req, res) {
  try {
    var themes = req.body;
    if (!Array.isArray(themes)) {
      return res.status(400).json({ success: false, error: 'Themes must be an array' });
    }
    var cal = store.read('academic_calendar');
    cal.monthlyThemes = themes;
    store.write('academic_calendar', cal);
    res.json({ success: true, themes: cal.monthlyThemes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/notice
router.put('/calendar/notice', auth.validateAdminSession, function (req, res) {
  try {
    var isActive = req.body.isActive;
    var type = req.body.type;
    var content = req.body.content;
    if (type && !VALID_NOTICE_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type. Use: ' + VALID_NOTICE_TYPES.join(', ') });
    }
    var cal = store.read('academic_calendar');
    cal.globalNotice = {
      isActive: Boolean(isActive),
      type: VALID_NOTICE_TYPES.includes(type) ? type : 'info',
      content: String(content || '')
    };
    store.write('academic_calendar', cal);
    res.json({ success: true, globalNotice: cal.globalNotice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 5: 创建 server/routes/venues.js**

从 `server/index.js` 第 728-826 行提取。**修复 #8：合并重复的 POST/PUT /api/venues。**

```javascript
// server/routes/venues.js
var express = require('express');
var router = express.Router();
var path = require('path');
var store = require('../store');
var auth = require('../middleware/auth');
var upload = require('../middleware/upload');

// GET /api/venues
router.get('/venues', function (req, res) {
  try {
    var data = store.read('campus_venues');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/venues/core/:id
router.put('/venues/core/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid venue data' });
    }
    var db = store.read('campus_venues');
    var coreIdx = db.coreVenues.findIndex(function (v) { return v.id === id; });
    if (coreIdx < 0) {
      return res.status(404).json({ success: false, error: 'Core venue not found' });
    }
    db.coreVenues[coreIdx] = Object.assign({}, db.coreVenues[coreIdx], updates, { id: id });
    store.write('campus_venues', db);
    res.json({ success: true, message: 'Core venue updated', venue: db.coreVenues[coreIdx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/venues/aux/:id
router.put('/venues/aux/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid venue data' });
    }
    var db = store.read('campus_venues');
    var auxIdx = db.auxVenues.findIndex(function (v) { return v.id === id; });
    if (auxIdx < 0) {
      return res.status(404).json({ success: false, error: 'Auxiliary venue not found' });
    }
    db.auxVenues[auxIdx] = Object.assign({}, db.auxVenues[auxIdx], updates, { id: id });
    store.write('campus_venues', db);
    res.json({ success: true, message: 'Auxiliary venue updated', venue: db.auxVenues[auxIdx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/venues/aux/:id
router.delete('/venues/aux/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var db = store.read('campus_venues');
    var lenBefore = db.auxVenues.length;
    db.auxVenues = db.auxVenues.filter(function (v) { return v.id !== id; });
    if (db.auxVenues.length === lenBefore) {
      return res.status(404).json({ success: false, error: 'Auxiliary venue not found' });
    }
    store.write('campus_venues', db);
    res.json({ success: true, message: 'Auxiliary venue deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/venues — 合并原来的 POST+PUT 为单一入口 (#8)
router.put('/venues', auth.validateAdminSession, function (req, res) {
  try {
    var data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid venues data' });
    }
    store.write('campus_venues', data);
    res.json({ success: true, message: 'Venues updated', data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload-venue
router.post('/upload-venue', auth.validateAdminSession, upload.uploadField.single('fieldImage'), upload.handleMulterError, function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    res.json({
      success: true,
      imagePath: '/assets/fields/' + req.file.filename,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 6: 创建 server/routes/admin.js**

从 `server/index.js` 第 401-436 行提取。**修复 #2（凭据外置）、#6（速率限制）。**

```javascript
// server/routes/admin.js
var express = require('express');
var router = express.Router();
var config = require('../config');
var auth = require('../middleware/auth');

// POST /api/admin/login — 修复 #6：加速率限制
router.post('/admin/login', auth.rateLimitLogin, function (req, res) {
  try {
    var password = req.body.password;
    if (password === config.ADMIN_PASSWORD) {
      res.json({ success: true, token: config.ADMIN_TOKEN });
    } else {
      res.status(401).json({ success: false, error: '安全密码错误，请重新输入' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/change-password
router.post('/admin/change-password', auth.validateAdminSession, function (req, res) {
  try {
    var oldPassword = req.body.oldPassword;
    var newPassword = req.body.newPassword;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '旧密码和新密码均不能为空' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码长度至少6位' });
    }
    if (oldPassword !== config.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: '旧密码错误' });
    }
    config.ADMIN_PASSWORD = newPassword;
    res.json({ success: true, message: '密码修改成功，请重新登录' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 7: 提交**

```bash
git add server/routes/
git commit -m "feat: split server routes into 6 modules with security fixes"
```

注意：此时旧 `server/index.js` 仍然完整可用（路由注册会与新的 Router 冲突）。下一步再替换。

---

### Task 5: 精简 server/index.js + 全局错误处理

**Files:**
- Modify: `server/index.js`（865 行 → ~40 行）
- Remove: 所有已迁出的路由代码

**涵盖的审查问题：** #5（sendFile try-catch）、#9（ID 生成已在上一步修复）

- [ ] **Step 1: 替换 server/index.js**

```javascript
// server/index.js — 精简入口，路由模块化挂载
var express = require('express');
var cors = require('cors');
var path = require('path');

var config = require('./config');
var app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 挂载路由模块
app.use('/api', require('./routes/curriculum'));
app.use('/api', require('./routes/gallery'));
app.use('/api', require('./routes/parkour'));
app.use('/api', require('./routes/calendar'));
app.use('/api', require('./routes/venues'));
app.use('/api', require('./routes/admin'));

// 静态页面 — 修复 #5：加 try-catch + 错误回调
app.get('/', function (req, res) {
  try {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'), function (err) {
      if (err) { res.status(500).json({ success: false, error: 'Page not found' }); }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/admin', function (req, res) {
  try {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'), function (err) {
      if (err) { res.status(500).json({ success: false, error: 'Page not found' }); }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 全局错误处理中间件
app.use(function (err, req, res, next) {
  console.error('[Server Error]', err.stack || err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(config.PORT, function () {
  console.log('\n🏅 Tsinglan PE CMS running at http://localhost:' + config.PORT);
  console.log('📋 Public page:  http://localhost:' + config.PORT + '/');
  console.log('⚙️  Admin panel: http://localhost:' + config.PORT + '/admin\n');
});
```

- [ ] **Step 2: 启动服务器验证路由不报错**

```bash
node server/index.js
# 预期：无 require() 报错，所有路由正确挂载
```

- [ ] **Step 3: 提交**

```bash
git add server/index.js
git commit -m "refactor: slim server entry to 40 lines, add global error handler"
```

---

### Task 6: 前端 CSS 提取

**Files:**
- Create: `public/css/main.css`
- Create: `public/css/splash.css`
- Create: `public/css/admin.css`
- Modify: `public/index.html`、`public/admin.html`

- [ ] **Step 1: 提取 public/css/splash.css**

从 `index.html` 第 3264-3279 行的 `<style>` 块提取 V9.0 splash 专用样式：

```css
/* public/css/splash.css — V9.0 Antigravity Spring Physics */
#splash-canvas{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;cursor:pointer;transition:opacity 0.8s ease;}
#splash-canvas.fade-out{opacity:0;pointer-events:none;}
#enter-hint{position:fixed;bottom:40px;left:50%;transform:translateX(-50%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#999;letter-spacing:2px;z-index:10001;pointer-events:none;opacity:0;transition:opacity 0.8s ease;}
#enter-hint.show{opacity:1;}
```

- [ ] **Step 2: 提取 public/css/main.css**

从 `index.html` 第 12-3262 行的主 `<style>` 块完整迁出。**CSS 选择器一字不改。**

- [ ] **Step 3: 从 admin.html 提取 public/css/admin.css**

从 `admin.html` 的 `<style>` 块完整迁出。

- [ ] **Step 4: 更新 index.html `<head>`**

```html
<!-- 替换原 3252 行 <style>...</style> 为： -->
<link rel="stylesheet" href="css/main.css">
<link rel="stylesheet" href="css/splash.css">
```

- [ ] **Step 5: 更新 admin.html `<head>`**

```html
<link rel="stylesheet" href="css/admin.css">
```

- [ ] **Step 6: 提交**

```bash
git add public/css/
git add public/index.html public/admin.html
git commit -m "refactor: extract CSS to external files"
```

---

### Task 7: 前端 JS 提取 — index.html

**Files:**
- Create: `public/js/utils.js`
- Create: `public/js/splash.js`
- Create: `public/js/venues.js`
- Create: `public/js/curriculum.js`
- Create: `public/js/calendar-view.js`
- Create: `public/js/gallery.js`
- Create: `public/js/parkour.js`
- Create: `public/js/app.js`
- Modify: `public/index.html`

这个任务将 `index.html` 中 4 个 `<script>` 块拆分为 8 个独立 JS 文件。

- [ ] **Step 1: 创建 public/js/splash.js**

将 `index.html` 第 5832-5969 行的 V9.0 IIFE 块完整迁出。在其顶部加 `window.Splash` 命名空间暴露：

```javascript
// public/js/splash.js
!function(){'use strict';

// ─── Config ───────────────────────────────────────
var SAMPLE_STEP=2,LOGO_W=528,LOGO_H=280;
// ... (完整 V9.0 引擎代码，143 行不变)

// 结尾：暴露命名空间
window.Splash = {
  isDismissed: function() { return dismissed; },
  dismiss: dismiss
};
}();
```

- [ ] **Step 2: 创建 public/js/utils.js**

```javascript
// public/js/utils.js — 公共工具函数
!function(){'use strict';

// 日期工具
window.Utils = {};

// 计算某月天数
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
window.Utils.daysInMonth = daysInMonth;

// HTML 转义
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
window.Utils.escapeHtml = escapeHtml;

// 简易 hash
function simpleHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}
window.Utils.simpleHash = simpleHash;

}();
```

- [ ] **Step 3: 创建 public/js/venues.js**

将 `index.html` 第 4651-4870 行附近的场馆相关函数迁出：
- `loadVenuesData()`, `renderVenueTabs()`, `switchVenue()`, `renderCoreVenue()`, `renderAuxVenues()`, `renderOrderBanner()`, `scrollToVenueShowcase()` 等

暴露 `window.Venues = { init, switchVenue }`。

- [ ] **Step 4: 创建 public/js/curriculum.js**

将课表相关函数迁出（`switchTable()`, `setSemesterMode()`, `navigateStation()`, 课表数据加载和渲染等）。

暴露 `window.Curriculum = { init, switchTable, showDetail }`。

- [ ] **Step 5: 创建 public/js/calendar-view.js**

将日历相关函数迁出（`renderCalendarGrid()`, `renderMonthNav()`, `navigateMonth()`, `goToToday()`, `onDayClick()`, `renderEventSidebar()` 等）。

暴露 `window.CalendarView = { init, goToToday }`。

- [ ] **Step 6: 创建 public/js/gallery.js**

将奥林匹克相册相关函数迁出（`openLightbox()`, `closeLightbox()`, 相册加载等）。

暴露 `window.Gallery = { init }`。

- [ ] **Step 7: 创建 public/js/parkour.js**

将跑酷相关函数迁出（`openPkLightbox()`, `closePkLightbox()`, `togglePkLightboxZoom()` 等）。

暴露 `window.Parkour = { init }`。

- [ ] **Step 8: 创建 public/js/app.js — 页面入口**

```javascript
// public/js/app.js — 页面初始化入口
!function(){'use strict';

// Scroll animations
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.fade-in-up').forEach(function(el) { observer.observe(el); });

// Navigation active-route detection
(function() {
  var path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(function(link) {
    link.classList.remove('active');
    var href = link.getAttribute('href');
    if (href === '/') {
      if (path === '/' || path === '/index.html' || path === '/index.htm') link.classList.add('active');
    } else if (href && path.includes(href.replace(/^\//, ''))) {
      link.classList.add('active');
    }
  });
})();

// Smooth scroll for hero stat cards
document.querySelectorAll('.hero-stats a[href^="#"]').forEach(function(card) {
  card.addEventListener('click', function(e) {
    e.preventDefault();
    var el = document.querySelector(this.getAttribute('href'));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Init all modules (when DOM ready)
function initAll() {
  if (window.Venues && window.Venues.init) window.Venues.init();
  if (window.Curriculum && window.Curriculum.init) window.Curriculum.init();
  if (window.CalendarView && window.CalendarView.init) window.CalendarView.init();
  if (window.Gallery && window.Gallery.init) window.Gallery.init();
  if (window.Parkour && window.Parkour.init) window.Parkour.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}

}();
```

- [ ] **Step 9: 更新 index.html 的 `<script>` 引用**

```html
<!-- 替换所有内联 <script> 块为： -->
<script src="js/splash.js"></script>
<script src="js/utils.js"></script>
<script src="js/venues.js"></script>
<script src="js/curriculum.js"></script>
<script src="js/calendar-view.js"></script>
<script src="js/gallery.js"></script>
<script src="js/parkour.js"></script>
<script src="js/app.js"></script>
```

- [ ] **Step 10: 验证 — 启动服务器**

```bash
node server/index.js
# 访问 http://localhost:3000
# 检查 console 无 "is not defined" 错误
# 逐一测试：splash 动画 → 课表切换 → 日历 → 相册 → 场馆 → 跑酷
```

- [ ] **Step 11: 提交**

```bash
git add public/js/ public/index.html
git commit -m "refactor: extract index.html JS into 8 IIFE modules"
```

---

### Task 8: 前端 JS 提取 — admin.html + calendar.html

**Files:**
- Create: `public/js/admin-curriculum.js`
- Create: `public/js/admin-gallery.js`
- Create: `public/js/admin-parkour.js`
- Create: `public/js/admin-calendar.js`
- Create: `public/js/admin-venues.js`
- Create: `public/js/admin-auth.js`
- Create: `public/js/admin-app.js`
- Create: `public/js/calendar-page.js`
- Modify: `public/admin.html`、`public/calendar.html`

- [ ] **Step 1: 拆分 admin.html 的两个 `<script>` 块**

按功能域拆分 admin.html 第 1270-2683 行和第 2977-3239 行：
- `admin-auth.js` — 登录、登出、改密码
- `admin-curriculum.js` — PreK/K/Climbing 课表 CRUD
- `admin-gallery.js` — 奥林匹克相册上传/编辑/删除
- `admin-parkour.js` — 晨间跑酷管理
- `admin-calendar.js` — 校历事件管理
- `admin-venues.js` — 场地管理
- `admin-app.js` — admin 页面入口，tab 切换协调

每个模块遵循相同的 IIFE 模式，暴露 `window.AdminXxx` 命名空间。

- [ ] **Step 2: 拆分 calendar.html 的脚本**

将 `calendar.html` 第 767-1281 行提取为 `public/js/calendar-page.js`：

```javascript
// public/js/calendar-page.js
!function(){'use strict';

// ... (完整 calendar 逻辑，~514 行不变，加 IIFE 包裹)

window.CalendarPage = { init: initAll, goToToday: goToToday };
}();
```

- [ ] **Step 3: 更新 admin.html 和 calendar.html 的 `<script>` 引用**

- [ ] **Step 4: 提交**

```bash
git add public/js/ public/admin.html public/calendar.html
git commit -m "refactor: extract admin.html and calendar.html JS into modules"
```

---

### Task 9: HTML 最终瘦身 + README 更新

**Files:**
- Modify: `public/index.html`（移除剩余内联代码）
- Modify: `public/admin.html`
- Modify: `public/calendar.html`
- Modify: `README.md`
- Modify: `server/data/admin_auth.json`（可选：移除默认凭据以鼓励 config.js）

**涵盖的审查问题：** #15（README 过时）

- [ ] **Step 1: 确认 HTML 文件只保留 DOM 骨架**

验证 `index.html` 中不再有 `<style>` 块（只剩 `<link>`），不再有长 `<script>` 块（只剩 `<script src="">` 引用）。

- [ ] **Step 2: 更新 README.md**

更新项目结构图，列出新的文件组织：

```
cms/
├── .gitignore
├── public/
│   ├── index.html / admin.html / calendar.html
│   ├── logo.png
│   ├── css/    (main.css, splash.css, admin.css)
│   ├── js/     (14 个模块化 JS 文件)
│   ├── assets/ (olympic/, parkour/, parkour-videos/, fields/)
│   └── photos/
├── server/
│   ├── index.js         (~40 行入口)
│   ├── config.js        (配置 + 凭据)
│   ├── store.js         (原子数据访问层)
│   ├── middleware/       (auth.js, upload.js)
│   ├── routes/           (6 个路由模块)
│   └── data/            (7 个 JSON 文件)
└── package.json
```

- [ ] **Step 3: 提交**

```bash
git add public/ README.md server/data/admin_auth.json
git commit -m "docs: update README with new project structure, slim HTML files"
```

---

### Task 10: 最终验证 + 端到端测试

- [ ] **Step 1: 启动服务器，全功能验证**

```bash
node server/index.js
```

| 验证项 | 方法 |
|---|---|
| Splash 动画 → 点击进入 | 浏览器打开 `localhost:3000`，观察粒子动画 |
| 课表展示 | 页面向下滚动到课表区域，切换 PreK/K/Climbing |
| 日历展示 | 查看校历，点击日期 |
| 相册 lightbox | 点击照片放大 |
| 场馆切换 | 切换核心场馆 tab |
| 跑酷 lightbox | 点击跑酷照片 |
| 管理后台 | 打开 `localhost:3000/admin`，测试登录/CRUD |
| Console 0 报错 | DevTools 检查 |

- [ ] **Step 2: 安全验证**

```bash
# 速率限制测试
for i in 1 2 3 4 5 6; do
  curl -s -X POST http://localhost:3000/api/admin/login -H 'Content-Type: application/json' -d '{"password":"wrong"}' | head -c 50
  echo
done
# 预期：前 5 次返回 401，第 6 次返回 429

# 路径遍历测试
curl -s -X DELETE http://localhost:3000/api/parkour-image \
  -H 'Content-Type: application/json' \
  -H 'x-admin-token: tsinglan_pe_secure_token_2026' \
  -d '{"imagePath":"../../../etc/passwd"}'
# 预期：400 Invalid image path
```

- [ ] **Step 3: 数据完整性验证**

模拟并发写入：用 2 个并行 curl 同时 PUT 数据，然后 GET 验证数据完整、不丢失。

- [ ] **Step 4: Playwright 截图对比**

```bash
# 截图重构后的页面，与之前的基线对比
```

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "chore: final verification — all modules working, security fixes verified

Refactored 3 monolithic HTML files + 1 server file into ~30 focused modules.
Fixed all 16 audit findings. Zero UI/functional/logic changes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 审查问题覆盖清单

| # | 问题 | 修复任务 |
|---|---|---|
| 1 | 无 .gitignore | Task 1 |
| 2 | 硬编码凭据 | Task 3 (config.js) + Task 5 |
| 3 | 路径遍历 | Task 4 Step 3 |
| 4 | 非原子写入 | Task 3 Step 2 (store.js) |
| 5 | sendFile 无 try-catch | Task 5 Step 1 |
| 6 | 登录无速率限制 | Task 3 Step 3 + Task 4 Step 6 |
| 7 | gallery 无输入验证 | Task 4 Step 2 |
| 8 | 重复 POST/PUT venues | Task 4 Step 5 |
| 9 | Date.now() ID 冲突 | Task 4 Step 2-4 |
| 10 | 事件不排序 | Task 4 Step 4 |
| 11 | multer 非官方包 | Task 2 |
| 12 | .bak/.DS_Store/ZIP | Task 1 |
| 13 | .playwright-mcp/ | Task 1 |
| 14 | 中文文件名 | 保留不变 |
| 15 | README 过时 | Task 9 |
| 16 | 测试截图 | Task 1 |
