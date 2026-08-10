// server/store.js — 统一 JSON 数据读写，Promise 链原子写入
var fs = require('fs');
var path = require('path');
var DATA_DIR = path.join(__dirname, 'data');

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

function read(name) {
  var f = file(name);
  var dir = path.dirname(f);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(f)) {
    var d = defaults[name] || {};
    fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(d));
  }
  var raw = fs.readFileSync(f, 'utf8');
  var data = JSON.parse(raw);
  // 向后兼容：自动补上 defaults 中定义但数据文件缺失的顶层字段
  var def = defaults[name];
  if (def && typeof def === 'object' && !Array.isArray(def)) {
    var changed = false;
    Object.keys(def).forEach(function (key) {
      if (!(key in data)) {
        data[key] = JSON.parse(JSON.stringify(def[key]));
        changed = true;
      }
    });
    if (changed) {
      fs.writeFile(f, JSON.stringify(data, null, 2), 'utf8', function (err) {
        if (err) console.error('[store] auto-migrate write failed for ' + name + ':', err.message);
      });
    }
  }
  return data;
}

function write(name, data) {
  var f = file(name);
  return new Promise(function (resolve, reject) {
    if (!queues[name]) queues[name] = Promise.resolve();
    queues[name] = queues[name].then(function () {
      return new Promise(function (res, rej) {
        var tmp = f + '.tmp.' + Date.now() + '.' + Math.random().toString(36).slice(2, 8);
        var dir = path.dirname(f);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8', function (err) {
          if (err) return rej(err);
          fs.rename(tmp, f, function (err2) {
            if (err2) return rej(err2);
            res();
          });
        });
      });
    }).catch(function (err) {
      console.error('[store] Write failed for ' + name + ':', err.message);
      throw err;
    }).then(function () { return undefined; });
    return queues[name];
  });
}

module.exports = { read: read, write: write };
