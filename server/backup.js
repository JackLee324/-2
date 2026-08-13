// server/backup.js — 数据自动备份：写入前快照 + 启动全量快照，保留最近 N 份
// 原则：只新增、不覆盖、不删除源数据；快照文件命名按时间可排序
var fs = require('fs');
var path = require('path');

var BACKUP_DIR = path.join(__dirname, '..', 'backups');
var DATA_DIR = path.join(__dirname, 'data');
var MAX_FILE_SNAPSHOTS = 20; // 每个数据文件保留最近 20 份
var MAX_FULL_SNAPSHOTS = 5;  // 保留最近 5 份全量快照

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function stamp() {
  // 可排序时间戳：2026-08-13T11-43-48-123Z
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// 单文件快照：在 write 前调用，保存「修改前」的状态
function snapshotFile(name) {
  try {
    var src = path.join(DATA_DIR, name + '.json');
    if (!fs.existsSync(src)) return;
    ensureDir();
    var dest = path.join(BACKUP_DIR, name + '.' + stamp() + '.json');
    fs.copyFileSync(src, dest);
    pruneFile(name);
  } catch (err) {
    // 备份失败不阻断主流程，仅记录（避免备份逻辑拖垮业务）
    console.error('[backup] snapshotFile failed for ' + name + ':', err.message);
  }
}

function pruneFile(name) {
  try {
    var prefix = name + '.';
    var files = fs.readdirSync(BACKUP_DIR)
      .filter(function (f) { return f.indexOf(prefix) === 0 && f.slice(-5) === '.json'; })
      .sort();
    while (files.length > MAX_FILE_SNAPSHOTS) {
      fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    }
  } catch (err) {
    console.error('[backup] pruneFile failed for ' + name + ':', err.message);
  }
}

// 全量快照：服务启动时调用，保存完整 data 目录
function snapshotAll() {
  try {
    ensureDir();
    var dest = path.join(BACKUP_DIR, 'full.' + stamp());
    fs.mkdirSync(dest, { recursive: true });
    var files = fs.readdirSync(DATA_DIR);
    files.forEach(function (f) {
      if (f.slice(-5) === '.json') {
        fs.copyFileSync(path.join(DATA_DIR, f), path.join(dest, f));
      }
    });
    pruneFull();
  } catch (err) {
    console.error('[backup] snapshotAll failed:', err.message);
  }
}

function pruneFull() {
  try {
    var dirs = fs.readdirSync(BACKUP_DIR)
      .filter(function (f) {
        return f.indexOf('full.') === 0 &&
          fs.statSync(path.join(BACKUP_DIR, f)).isDirectory();
      })
      .sort();
    while (dirs.length > MAX_FULL_SNAPSHOTS) {
      fs.rmSync(path.join(BACKUP_DIR, dirs.shift()), { recursive: true, force: true });
    }
  } catch (err) {
    console.error('[backup] pruneFull failed:', err.message);
  }
}

module.exports = { snapshotFile: snapshotFile, snapshotAll: snapshotAll };
