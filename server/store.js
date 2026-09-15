// server/store.js — 统一 JSON 数据读写
// 特性：
//  1. 写前自动备份（backup.snapshotFile）
//  2. 原子写入（临时文件 + rename）
//  3. mutate() 提供原子 read-modify-write，消除竞态
//  4. 队列不会被单次失败「毒化」（失败后后续写仍可执行）
var fs = require('fs');
var path = require('path');
var backup = require('./backup');
var logger = require('./logger');
// 支持 DATA_DIR 环境变量覆盖（测试隔离用），默认 server/data
var DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// 数据 schema 版本：结构变更时递增，用于追踪与兼容
var SCHEMA_VERSION = 1;

var defaults = {
  curriculum: { prek: [], k: [], climbing: [] },
  olympic_gallery: [],
  morning_parkour: [],
  parkour_videos: [],
  academic_calendar: { monthlyThemes: [], events: [], globalNotice: { isActive: false, type: 'info', content: '' }, classes: [], venueReservations: [] },
  campus_venues: { coreVenues: [], auxVenues: [], rules: { equipmentReturn: '', bikeParking: '' } },
  admin_auth: { adminPassword: '123456', adminToken: 'tsinglan_pe_secure_token_2026' }
};

var queues = {};

function file(name) {
  return path.join(DATA_DIR, name + '.json');
}

// 内部：纯内存读取 + 默认字段补齐（无写副作用）
// 读取数据文件内容，并把「空内容」识别为故障而不是合法数据。
// 背景：磁盘/云盘异常时文件可以有正常大小却读出 0 字节，若放任下去会
// 被 JSON.parse 报成难以定位的 "Unexpected end of JSON input"，
// 更糟的是可能被当成空数据回写、覆盖真实内容。这里显式拦截并给出可操作提示。
function readRaw(name, f) {
  var raw = fs.readFileSync(f, 'utf8');
  if (!raw || !raw.trim()) {
    throw new Error('数据文件读取为空，疑似存储层异常（未回写、未覆盖原文件）: ' + f);
  }
  return raw;
}

function readInMemory(name) {
  var f = file(name);
  var dir = path.dirname(f);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(f)) {
    return JSON.parse(JSON.stringify(defaults[name] || {}));
  }
  var data = JSON.parse(readRaw(name, f));
  var def = defaults[name];
  if (def && typeof def === 'object' && !Array.isArray(def)) {
    Object.keys(def).forEach(function (key) {
      if (!(key in data)) data[key] = JSON.parse(JSON.stringify(def[key]));
    });
  }
  return data;
}

// 对外读取：同步，带默认字段补齐；首次缺失时落盘
function read(name) {
  var f = file(name);
  var dir = path.dirname(f);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(f)) {
    var d = defaults[name] || {};
    fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(d));
  }
  var raw = readRaw(name, f);
  var data = JSON.parse(raw);
  // 向后兼容：自动补上 defaults 中定义但数据文件缺失的顶层字段
  var def = defaults[name];
  if (def && typeof def === 'object' && !Array.isArray(def)) {
    var changed = false;
    var addedFields = [];
    Object.keys(def).forEach(function (key) {
      if (!(key in data)) {
        data[key] = JSON.parse(JSON.stringify(def[key]));
        changed = true;
        addedFields.push(key);
      }
    });
    if (changed) {
      logger.info('auto-migrate', { file: name, addedFields: addedFields, schemaVersion: SCHEMA_VERSION });
      fs.writeFile(f, JSON.stringify(data, null, 2), 'utf8', function (err) {
        if (err) logger.error('auto-migrate write failed', { file: name, message: err.message });
      });
    }
  }
  return data;
}

// 内部：原子写入（临时文件 + rename），写前备份
function writeRaw(name, data) {
  return new Promise(function (resolve, reject) {
    backup.snapshotFile(name); // 写前快照「修改前」状态
    var f = file(name);
    var tmp = f + '.tmp.' + Date.now() + '.' + Math.random().toString(36).slice(2, 8);
    var dir = path.dirname(f);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8', function (err) {
      if (err) return reject(err);
      fs.rename(tmp, f, function (err2) {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}

// 队列调度：失败不毒化队列，返回值供调用者 await/catch
function enqueue(name, task) {
  if (!queues[name]) queues[name] = Promise.resolve();
  var p = queues[name].then(task);
  queues[name] = p.catch(function (err) {
    console.error('[store] task failed for ' + name + ':', err.message);
  });
  return p;
}

// 对外写入：异步，队列串行 + 原子 + 备份
function write(name, data) {
  return enqueue(name, function () {
    return writeRaw(name, data);
  });
}

// 原子 read-modify-write：读取、修改、写入全程在队列内，消除竞态
// updaterFn(data) 返回新数据；resolve 为新数据（未变时返回原数据）
function mutate(name, updaterFn) {
  return enqueue(name, function () {
    var data = readInMemory(name);
    var result = updaterFn(data);
    var newData = (result === undefined) ? data : result;
    return writeRaw(name, newData).then(function () { return newData; });
  });
}

module.exports = { read: read, write: write, mutate: mutate };
