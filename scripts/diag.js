// scripts/diag.js — 只读诊断：服务是否在跑、数据接口与静态资源是否正常
//
// 用途：不依赖任何外部命令（不需要 curl / pgrep），只用 Node 内置模块判断
//       服务当前状态。适合在「不确定服务活没活」时先跑一遍。
//
// 用法：node ~/Developer/cms/scripts/diag.js
//
// 只读：不修改任何文件、不重启任何进程。

var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var PORT = process.env.PORT || 3000;

var pass = 0, fail = 0;

function ok(m)  { console.log('  ✅ ' + m); pass++; }
function bad(m) { console.log('  ❌ ' + m); fail++; }

function req(method, urlPath, cb) {
  var r = http.request({ host: '127.0.0.1', port: PORT, path: urlPath, method: method, timeout: 10000 },
    function (res) {
      var len = 0;
      res.on('data', function (c) { len += c.length; });
      res.on('end', function () { cb(res.statusCode, len, null); });
    });
  r.on('timeout', function () { r.destroy(); cb(0, 0, 'timeout'); });
  r.on('error', function (e) { cb(0, 0, e.message); });
  r.end();
}

console.log('');
console.log('════════ 服务诊断 ' + new Date().toLocaleString('zh-CN') + ' ════════');

console.log('');
console.log('[1] 服务是否在运行 (http://localhost:' + PORT + ')');

req('GET', '/api/health', function (code, len, err) {
  if (code === 0) {
    bad('无法连接：' + err);
    console.log('');
    console.log('  → 服务没在运行。启动命令：');
    console.log('      cd ' + ROOT + ' && npm start');
    console.log('');
    process.exit(1);
  }

  ok('服务有响应（HTTP ' + code + '，' + len + ' 字节）');

  console.log('');
  console.log('[2] 数据接口');
  var eps = ['/api/health', '/api/venues', '/api/curriculum', '/api/parkour', '/api/gallery', '/api/calendar'];
  var i = 0;
  (function next() {
    if (i >= eps.length) return afterApis();
    var ep = eps[i++];
    req('GET', ep, function (c, l) {
      if (c === 200 && l > 0) ok('GET ' + ep + ' → 200 (' + l + ' 字节)');
      else bad('GET ' + ep + ' → ' + (c || '无响应') + ' (' + l + ' 字节)');
      next();
    });
  })();

  function afterApis() {
    console.log('');
    console.log('[3] 静态资源非空（0 字节是静默故障特征）');
    var assets = ['/js/app.js', '/js/admin.js', '/js/calendar.js', '/js/admin-venues.js', '/js/splash.js',
      '/js/error-handler.js', '/css/main.css', '/css/admin.css', '/css/calendar.css', '/css/splash.css',
      '/index.html', '/admin.html', '/calendar.html', '/logo.png'];
    var j = 0;
    (function nextA() {
      if (j >= assets.length) return afterAssets();
      var u = assets[j++];
      req('GET', u, function (c, l) {
        if (c === 200 && l > 0) ok(u + ' (' + l + ' 字节)');
        else bad(u + ' → HTTP ' + (c || '无响应') + '，' + l + ' 字节');
        nextA();
      });
    })();

    function afterAssets() {
      console.log('');
      console.log('[4] 数据文件');
      var dataDir = path.join(ROOT, 'server', 'data');
      var files;
      try { files = fs.readdirSync(dataDir).filter(function (f) { return f.slice(-5) === '.json'; }); }
      catch (e) { files = []; bad('数据目录不可读：' + e.message); }
      files.forEach(function (f) {
        var full = path.join(dataDir, f);
        try {
          var raw = fs.readFileSync(full, 'utf8');
          if (!raw.trim()) { bad(f + ' 内容为空'); return; }
          JSON.parse(raw);
          ok(f + ' (' + raw.length + ' 字节)');
        } catch (e) { bad(f + ' ' + e.message); }
      });

      console.log('');
      console.log('════════ 结果 ════════');
      console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
      console.log('');
      if (fail === 0) {
        console.log('  ✅ 服务与数据全部正常');
        console.log('');
        console.log('  想进一步确认登录凭据，请再跑：');
        console.log('    node ' + path.join(ROOT, 'scripts', 'diag-login.js'));
      } else {
        console.log('  ❌ 有 ' + fail + ' 项异常，见上方 ❌ 标记');
        console.log('  服务日志：' + path.join(ROOT, 'logs', 'server.out'));
      }
      console.log('');
      process.exit(fail === 0 ? 0 : 1);
    }
  }
});
