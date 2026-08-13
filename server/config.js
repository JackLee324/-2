// server/config.js — 配置集中管理，优先级：环境变量 > admin_auth.json > 默认值
// 认证凭据持久化在 data/admin_auth.json，避免硬编码随代码入库
var fs = require('fs');
var path = require('path');

var ADMIN_AUTH_FILE = path.join(__dirname, 'data', 'admin_auth.json');

function loadAdminAuth() {
  try {
    if (fs.existsSync(ADMIN_AUTH_FILE)) {
      var parsed = JSON.parse(fs.readFileSync(ADMIN_AUTH_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    // 读取失败时回退默认值，不阻断启动
    console.error('[config] load admin_auth.json failed:', e.message);
  }
  return {};
}

var auth = loadAdminAuth();

module.exports = {
  PORT: process.env.PORT || 3000,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || auth.adminToken || 'tsinglan_pe_secure_token_2026',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || auth.adminPassword || '123456',
  UPLOAD_MAX_SIZE: 200 * 1024 * 1024,
  FIELD_UPLOAD_MAX_SIZE: 5 * 1024 * 1024,
  PARKOUR_VIDEO_MAX_SIZE: 500 * 1024 * 1024
};
