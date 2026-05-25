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
