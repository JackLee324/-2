// server/config.js — 配置集中管理，优先级：环境变量 > admin_auth.json > 首次自动生成
// 认证凭据只持久化在 data/admin_auth.json，绝不硬编码进代码或随 git 入库
//
// 安全原则（防止「静默降级到弱口令」）：
//   凭据文件缺失或损坏时，不再悄悄回退到 '123456' 这类公开默认值，
//   而是自动生成一组随机强凭据写盘，并在启动日志中打印一次。
//   这样既不会让后台在无提示的情况下敞开，也不会让服务无法启动。
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

// 惰性取值：测试会先设置 process.env.DATA_DIR，再 require 本模块
function dataDir() {
  return process.env.DATA_DIR || path.join(__dirname, 'data');
}

function authFilePath() {
  return path.join(dataDir(), 'admin_auth.json');
}

var warnedNoFile = false;

// 读取持久化凭据；文件不存在/损坏时返回 null（由 readCredentials 兜底）
function loadPersistedAuth() {
  var file = authFilePath();
  try {
    if (!fs.existsSync(file)) return null;
    var raw = fs.readFileSync(file, 'utf8');
    if (!raw || !raw.trim()) {
      console.error('[config] ' + file + ' 内容为空，将重新生成凭据');
      return null;
    }
    var parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    console.error('[config] ' + file + ' 结构异常，将重新生成凭据');
  } catch (e) {
    console.error('[config] 读取 admin_auth.json 失败:', e.message);
  }
  return null;
}

function secret(bytes) {
  return crypto.randomBytes(bytes).toString('base64url');
}

// 首次运行（无凭据文件）时生成一组随机强凭据并落盘
function generateAndPersist() {
  var generated = { adminPassword: secret(12), adminToken: secret(24) };
  try {
    var dir = dataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(authFilePath(), JSON.stringify(generated, null, 2), { encoding: 'utf8', mode: 0o600 });
    console.log('\n[config] 未找到凭据文件，已自动生成随机凭据并写入: ' + authFilePath());
    console.log('[config] 管理员密码: ' + generated.adminPassword);
    console.log('[config] 请登录后台后在「安全设置」中修改密码。\n');
  } catch (e) {
    console.error('[config] 写入凭据文件失败:', e.message);
  }
  return generated;
}

// 凭据解析：环境变量 > 持久化文件 > 自动生成（绝不使用硬编码默认值）
function readCredentials() {
  var persisted = loadPersistedAuth();
  var password = process.env.ADMIN_PASSWORD || (persisted && persisted.adminPassword);
  var token = process.env.ADMIN_TOKEN || (persisted && persisted.adminToken);
  if (password && token) return { password: password, token: token };

  if (!warnedNoFile) {
    warnedNoFile = true;
    console.error('[config] 凭据不完整（缺少 ' +
      (password ? '' : 'adminPassword ') + (token ? '' : 'adminToken') +
      '），正在生成新的随机凭据，原有登录可能失效');
  }
  var generated = generateAndPersist();
  return {
    password: password || generated.adminPassword,
    token: token || generated.adminToken
  };
}

module.exports = {
  PORT: process.env.PORT || 3000,
  // 以下两项用取值器：既支持运行期赋值（改密码时不重启即生效），
  // 也保证凭据只从文件/环境变量读取，代码里没有任何默认口令
  get ADMIN_TOKEN() { return readCredentials().token; },
  set ADMIN_TOKEN(v) { process.env.ADMIN_TOKEN = v; },
  get ADMIN_PASSWORD() { return readCredentials().password; },
  set ADMIN_PASSWORD(v) { process.env.ADMIN_PASSWORD = v; },
  UPLOAD_MAX_SIZE: 200 * 1024 * 1024,
  FIELD_UPLOAD_MAX_SIZE: 5 * 1024 * 1024,
  PARKOUR_VIDEO_MAX_SIZE: 500 * 1024 * 1024
};
