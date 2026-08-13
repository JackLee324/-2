// server/logger.js — 轻量结构化日志：JSON 行输出到 stdout + 追加到日志文件
// 支持 requestId 关联，便于追踪「用户 → 请求 → API → 数据」链路
var fs = require('fs');
var path = require('path');

var LOG_DIR = path.join(__dirname, '..', 'logs');
var LOG_FILE = path.join(LOG_DIR, 'app.log');

function ensureDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (e) {}
}

function line(level, message, meta) {
  var entry = { time: new Date().toISOString(), level: level, message: message };
  if (meta && typeof meta === 'object') {
    Object.keys(meta).forEach(function (k) { entry[k] = meta[k]; });
  }
  return JSON.stringify(entry);
}

function write(level, message, meta) {
  var l = line(level, message, meta);
  if (level === 'error') console.error(l);
  else console.log(l);
  try {
    ensureDir();
    fs.appendFileSync(LOG_FILE, l + '\n', 'utf8');
  } catch (e) {
    // 日志写入失败不影响业务
    console.error('[logger] append failed:', e.message);
  }
}

module.exports = {
  info: function (message, meta) { write('info', message, meta); },
  warn: function (message, meta) { write('warn', message, meta); },
  error: function (message, meta) { write('error', message, meta); }
};
