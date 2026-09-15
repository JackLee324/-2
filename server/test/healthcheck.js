// server/test/healthcheck.js — 存储层巡检（只读，不修改任何数据）
//
// 背景：本机曾发生 iCloud 把项目文件内容抽走（dataless）的事件，
// 症状是「接口返回正常但内容是空的」——即文件大小看着正常，
// 读出来却是 0 字节，页面样式和功能静默失效，不会报错。
// 该脚本用于提前发现这类问题：
//   1. 扫描项目内是否有 dataless（内容被抽回云端）的文件
//   2. 逐个校验数据文件能否正常读出并解析为 JSON
//   3. 任何异常以退出码 1 结束，方便接入定时任务
//
// 用法：npm run healthcheck
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var ROOT = path.join(__dirname, '..', '..');
var DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'server', 'data');

// 与业务数据无关、体积大且可再生的目录，不做逐文件扫描
var SKIP_DIRS = ['node_modules', '.git'];

var problems = [];

// 1. 扫描被抽走内容的文件（macOS 特有标志）
function findEvicted() {
  var found = [];
  var stack = [ROOT];
  while (stack.length) {
    var dir = stack.pop();
    var entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (var i = 0; i < entries.length; i++) {
      var ent = entries[i];
      var full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.indexOf(ent.name) === -1) stack.push(full);
        continue;
      }
      // ls -lO 输出中的 dataless 表示内容不在本地
      try {
        var out = childProcess.execFileSync('ls', ['-lO', full], { encoding: 'utf8' });
        if (out.indexOf('dataless') !== -1) found.push(path.relative(ROOT, full));
      } catch (e) { /* 单个文件查不到不影响整体巡检 */ }
    }
  }
  return found;
}

// 2. 校验数据文件可读且是合法 JSON
function checkDataFiles() {
  var files;
  try { files = fs.readdirSync(DATA_DIR).filter(function (f) { return f.slice(-5) === '.json'; }); }
  catch (e) {
    problems.push('数据目录不可读: ' + DATA_DIR + ' — ' + e.message);
    return [];
  }
  var results = [];
  files.forEach(function (f) {
    var full = path.join(DATA_DIR, f);
    var status;
    try {
      var raw = fs.readFileSync(full, 'utf8');
      if (!raw || !raw.trim()) {
        problems.push(f + ' 读取为空（文件被抽走内容或已损坏）');
        status = '空';
      } else {
        JSON.parse(raw);
        status = '正常 (' + raw.length + ' 字节)';
      }
    } catch (e) {
      problems.push(f + ' 校验失败: ' + e.message);
      status = '异常';
    }
    results.push([f, status]);
  });
  return results;
}

var evicted = findEvicted();
var dataResults = checkDataFiles();

console.log('\n=== 存储层巡检 ' + new Date().toLocaleString('zh-CN') + ' ===\n');

console.log('[数据文件] (' + DATA_DIR + ')');
dataResults.forEach(function (r) {
  console.log('  ' + (r[1].indexOf('正常') === 0 ? '✅' : '❌') + ' ' + r[0] + ' — ' + r[1]);
});
if (!dataResults.length) console.log('  （未找到数据文件）');

console.log('\n[文件内容完整性]');
if (evicted.length === 0) {
  console.log('  ✅ 未发现被抽走内容的文件');
} else {
  console.log('  ❌ 发现 ' + evicted.length + ' 个文件内容不在本地（读取会失败或返回空）:');
  evicted.slice(0, 20).forEach(function (f) { console.log('     ' + f); });
  if (evicted.length > 20) console.log('     ... 其余 ' + (evicted.length - 20) + ' 个');
  console.log('\n  修复方式（逐条执行，只把内容取回本地，不改动文件内容）:');
  console.log('     brctl download "<上面的文件路径>"');
  console.log('  若大量出现，说明同步盘仍在抽走内容，建议把项目移出同步目录。');
}

console.log('');
if (problems.length) {
  console.log('结论: ❌ 发现 ' + problems.length + ' 个问题');
  process.exit(1);
}
console.log('结论: ✅ 存储层正常');
process.exit(0);
