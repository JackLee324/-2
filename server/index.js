// server/index.js — 精简入口，路由模块化挂载
var express = require('express');
var cors = require('cors');
var compression = require('compression');
var path = require('path');
var fs = require('fs');

var config = require('./config');
var backup = require('./backup');
var logger = require('./logger');
var auth = require('./middleware/auth');
var app = express();

// 启动时全量快照数据目录，作为当日恢复基线
backup.snapshotAll();

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// 请求 ID + 结构化访问日志
app.use(function (req, res, next) {
  req.requestId = 'req' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var start = Date.now();
  res.on('finish', function () {
    logger.info('request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip || req.connection.remoteAddress
    });
  });
  next();
});

// 写接口通用限流（登录接口另有两级更严格限流）
app.use('/api', function (req, res, next) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH') {
    return auth.rateLimitWrite(req, res, next);
  }
  next();
});

// 静态资源：图片 1 年缓存，HTML/JS/CSS 不缓存（开发阶段避免浏览器缓存旧代码）
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1y',
  setHeaders: function (res, filePath) {
    if (/\.(html|js|css)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// 挂载路由模块
app.use('/api', require('./routes/curriculum'));
app.use('/api', require('./routes/gallery'));
app.use('/api', require('./routes/parkour'));
app.use('/api', require('./routes/calendar'));
app.use('/api', require('./routes/venues'));
app.use('/api', require('./routes/admin'));

// 健康检查端点 — 同时检测关键数据文件可读性
app.get('/api/health', function (req, res) {
  var dataReadable = true;
  try {
    var dataDir = path.join(__dirname, 'data');
    ['academic_calendar', 'campus_venues', 'curriculum'].forEach(function (name) {
      var f = path.join(dataDir, name + '.json');
      if (!fs.existsSync(f)) dataReadable = false;
      else JSON.parse(fs.readFileSync(f, 'utf8')); // 校验 JSON 可解析
    });
  } catch (e) {
    dataReadable = false;
  }
  res.json({
    status: dataReadable ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: Date.now(),
    dataReadable: dataReadable
  });
});

// 静态页面 — try-catch + 错误回调
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

app.get('/calendar', function (req, res) {
  try {
    res.sendFile(path.join(__dirname, '..', 'public', 'calendar.html'), function (err) {
      if (err) { res.status(500).json({ success: false, error: 'Page not found' }); }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 全局错误处理中间件
app.use(function (err, req, res, next) {
  logger.error('unhandled error', {
    requestId: req.requestId,
    message: err.message,
    stack: err.stack
  });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// 仅在直接运行时启动服务器（被 require 时不启动，方便测试）
if (require.main === module) {
  var server = app.listen(config.PORT, function () {
    logger.info('server started', { port: config.PORT });
    console.log('\n🏅 Tsinglan PE CMS running at http://localhost:' + config.PORT);
    console.log('📋 Public page:  http://localhost:' + config.PORT + '/');
    console.log('⚙️  Admin panel: http://localhost:' + config.PORT + '/admin');
    console.log('📅 Calendar:     http://localhost:' + config.PORT + '/calendar\n');
  });

  // 优雅关闭
  process.on('SIGTERM', function () {
    logger.info('server shutting down (SIGTERM)');
    console.log('[Server] SIGTERM — shutting down gracefully');
    server.close(function () { process.exit(0); });
  });
}

module.exports = app;
