// scripts/check-syntax.js — 内部自检：确认 bash 脚本无语法错误
//
// 说明：本脚本用 `bash -n`（只做语法解析、不执行）检查 shell 脚本。
//       仅用于交付前自检；日常运维不需要运行它。
//
// 用法：node ~/Developer/cms/scripts/check-syntax.js

var cp = require('child_process');
var path = require('path');
var fs = require('fs');

var scriptsDir = __dirname;
var targets = fs.readdirSync(scriptsDir).filter(function (f) { return f.slice(-3) === '.sh'; });

if (!targets.length) {
  console.log('没有找到需要检查的 .sh 脚本');
} else {
  var bad = 0;
  targets.forEach(function (f) {
    var full = path.join(scriptsDir, f);
    var r = cp.spawnSync('bash', ['-n', full], { encoding: 'utf8' });
    if (r.error) {
      console.log('  ⚠️  ' + f + ' 无法检查：' + r.error.message);
      bad++;
      return;
    }
    if (r.status === 0) {
      console.log('  ✅ ' + f + ' 语法正确');
    } else {
      console.log('  ❌ ' + f + ' 语法错误：');
      console.log((r.stderr || '').trim());
      bad++;
    }
  });
  if (bad) process.exit(1);
}

// 同时检查本目录下的 .js 文件
var jsFiles = fs.readdirSync(scriptsDir).filter(function (f) { return f.slice(-3) === '.js'; });
var jsBad = 0;
jsFiles.forEach(function (f) {
  var full = path.join(scriptsDir, f);
  var r = cp.spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
  if (r.status === 0) {
    console.log('  ✅ ' + f + ' 语法正确');
  } else {
    console.log('  ❌ ' + f + ' 语法错误：');
    console.log((r.stderr || '').trim());
    jsBad++;
  }
});

if (bad + jsBad > 0) {
  console.log('\n合计 ' + (bad + jsBad) + ' 个文件存在语法问题');
  process.exit(1);
}
console.log('\n全部脚本语法正确');
