// scripts/diag-login.js — 排查「后台登录失败」的只读诊断工具
//
// 用途：当 finalize.sh 报「新密码登录失败」时，用本脚本定位原因。
//       它按服务端完全相同的逻辑读取凭据，并实际调用一次登录接口比对。
//
// 用法：node ~/Developer/cms/scripts/diag-login.js
//
// 只读：不修改任何文件、不写入任何数据。

var fs = require('fs');
var path = require('path');
var http = require('http');

var ROOT = path.join(__dirname, '..');
var AUTH_FILE = path.join(ROOT, 'server', 'data', 'admin_auth.json');
var PORT = process.env.PORT || 3000;

function line(s) { console.log(s); }

line('');
line('════════ 登录诊断 ════════');

// 1. 凭据文件
line('');
line('[1] 凭据文件');
line('    路径: ' + AUTH_FILE);
if (!fs.existsSync(AUTH_FILE)) {
  line('    ❌ 文件不存在 —— 服务重启时会自动生成新凭据并打印到 logs/server.out');
  process.exit(1);
}
var st = fs.statSync(AUTH_FILE);
line('    大小: ' + st.size + ' 字节');
if (st.size === 0) {
  line('    ❌ 文件为空（存储层异常特征）—— 删除该文件后重启服务可自动重建');
  process.exit(1);
}

var creds;
try {
  creds = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
} catch (e) {
  line('    ❌ JSON 解析失败: ' + e.message);
  process.exit(1);
}
var password = creds.adminPassword;
var token = creds.adminToken;
if (!password || !token) {
  line('    ❌ 缺少字段：' + (!password ? 'adminPassword ' : '') + (!token ? 'adminToken' : ''));
  process.exit(1);
}
line('    ✅ 可解析');
line('    密码: ' + password + '（' + password.length + ' 位）');
line('    Token: ' + token.slice(0, 12) + '...（' + token.length + ' 位）');

// 2. 环境变量是否覆盖（优先级高于文件）
line('');
line('[2] 环境变量覆盖检查');
var envPw = process.env.ADMIN_PASSWORD;
var envTk = process.env.ADMIN_TOKEN;
if (envPw || envTk) {
  line('    ⚠️  检测到环境变量，它的优先级高于文件：');
  if (envPw) line('        ADMIN_PASSWORD=' + envPw);
  if (envTk) line('        ADMIN_TOKEN=' + envTk.slice(0, 12) + '...');
  line('    → 若登录用的是环境变量里的值，请以它为准');
} else {
  line('    ✅ 未设置，凭据以文件为准');
}

// 3. 实际调用登录接口
line('');
line('[3] 调用 POST http://localhost:' + PORT + '/api/admin/login');

var payload = JSON.stringify({ password: password });
var req = http.request({
  host: '127.0.0.1', port: PORT, path: '/api/admin/login', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, function (res) {
  var body = '';
  res.on('data', function (c) { body += c; });
  res.on('end', function () {
    line('    HTTP ' + res.statusCode);
    line('    响应: ' + body);

    var json = null;
    try { json = JSON.parse(body); } catch (e) { /* 保持 null */ }

    line('');
    line('[4] 结论');
    if (res.statusCode === 200 && json && json.success === true) {
      line('    ✅ 登录成功');
      if (json.token === token) {
        line('    ✅ 返回 token 与文件一致 —— 凭据已正确生效');
      } else {
        line('    ⚠️  返回 token 与文件不一致：');
        line('        文件: ' + token);
        line('        返回: ' + json.token);
        line('        → 服务可能仍是旧进程（未重启）。重启服务后重试。');
      }
      process.exit(0);
    }
    if (res.statusCode === 401) {
      line('    ❌ 密码错误（HTTP 401）');
      line('        → 你使用的密码与文件中的不一致。');
      line('        → 若你曾在后台改过密码，以 server/data/admin_auth.json 为准。');
      process.exit(1);
    }
    if (res.statusCode === 429) {
      line('    ❌ 触发登录限流（HTTP 429）：同 IP 60 秒内最多 5 次');
      line('        → 等 60 秒后重试');
      process.exit(1);
    }
    if (res.statusCode === 0 || !body) {
      line('    ❌ 服务无响应 —— 可能没在运行');
      line('        → 启动命令：cd ' + ROOT + ' && npm start');
      process.exit(1);
    }
    line('    ❌ 未预期的响应，请把以上内容提供给排查者');
    process.exit(1);
  });
});

req.on('error', function (e) {
  line('    ❌ 无法连接: ' + e.message);
  line('');
  line('[4] 结论');
  line('    ❌ 服务未运行或未监听 ' + PORT + ' 端口');
  line('        → 启动命令：cd ' + ROOT + ' && npm start');
  process.exit(1);
});
req.write(payload);
req.end();
