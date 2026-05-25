// server/index.js — 精简入口，路由模块化挂载
var express = require('express');
var cors = require('cors');
var compression = require('compression');
var path = require('path');

var config = require('./config');
var app = express();

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// 静态资源：JS/CSS/图片 1 年缓存，HTML 不缓存
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1y',
  setHeaders: function (res, filePath) {
    if (/\.html$/.test(filePath)) {
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

// 健康检查端点
app.get('/api/health', function (req, res) {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
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
  console.error('[Server Error]', err.stack || err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

var server = app.listen(config.PORT, function () {
  console.log('\n🏅 Tsinglan PE CMS running at http://localhost:' + config.PORT);
  console.log('📋 Public page:  http://localhost:' + config.PORT + '/');
  console.log('⚙️  Admin panel: http://localhost:' + config.PORT + '/admin');
  console.log('📅 Calendar:     http://localhost:' + config.PORT + '/calendar\n');
});

// 优雅关闭
process.on('SIGTERM', function () {
  console.log('[Server] SIGTERM — shutting down gracefully');
  server.close(function () { process.exit(0); });
});
