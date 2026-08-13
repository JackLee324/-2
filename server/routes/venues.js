// server/routes/venues.js
var express = require('express');
var router = express.Router();
var store = require('../store');
var auth = require('../middleware/auth');
var upload = require('../middleware/upload');

// GET /api/venues
router.get('/venues', function (req, res) {
  try {
    var data = store.read('campus_venues');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 校验整表覆盖的数据结构，防止误传格式清空数据
function validateVenuesShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Invalid venues data';
  if (!Array.isArray(data.coreVenues)) return 'coreVenues must be an array';
  if (!Array.isArray(data.auxVenues)) return 'auxVenues must be an array';
  if (!data.rules || typeof data.rules !== 'object') return 'rules must be an object';
  return null;
}

// PUT /api/venues/core/:id
router.put('/venues/core/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid venue data' });
    }
    var updated = null;
    store.mutate('campus_venues', function (db) {
      var coreIdx = db.coreVenues.findIndex(function (v) { return v.id === id; });
      if (coreIdx < 0) return db;
      db.coreVenues[coreIdx] = Object.assign({}, db.coreVenues[coreIdx], updates, { id: id });
      updated = db.coreVenues[coreIdx];
      return db;
    }).then(function () {
      if (!updated) return res.status(404).json({ success: false, error: 'Core venue not found' });
      res.json({ success: true, message: 'Core venue updated', venue: updated });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/venues/aux/:id
router.put('/venues/aux/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid venue data' });
    }
    var updated = null;
    store.mutate('campus_venues', function (db) {
      var auxIdx = db.auxVenues.findIndex(function (v) { return v.id === id; });
      if (auxIdx < 0) return db;
      db.auxVenues[auxIdx] = Object.assign({}, db.auxVenues[auxIdx], updates, { id: id });
      updated = db.auxVenues[auxIdx];
      return db;
    }).then(function () {
      if (!updated) return res.status(404).json({ success: false, error: 'Auxiliary venue not found' });
      res.json({ success: true, message: 'Auxiliary venue updated', venue: updated });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/venues/aux/:id
router.delete('/venues/aux/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var deleted = false;
    store.mutate('campus_venues', function (db) {
      var lenBefore = db.auxVenues.length;
      db.auxVenues = db.auxVenues.filter(function (v) { return v.id !== id; });
      deleted = db.auxVenues.length < lenBefore;
      return db;
    }).then(function () {
      if (!deleted) return res.status(404).json({ success: false, error: 'Auxiliary venue not found' });
      res.json({ success: true, message: 'Auxiliary venue deleted' });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/venues — 整表覆盖（带结构校验）
router.put('/venues', auth.validateAdminSession, function (req, res) {
  try {
    var data = req.body;
    var err = validateVenuesShape(data);
    if (err) return res.status(400).json({ success: false, error: err });
    store.write('campus_venues', data).then(function () {
      res.json({ success: true, message: 'Venues updated', data: data });
    }).catch(function (e) {
      res.status(500).json({ success: false, error: e.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/venues — 保留 POST 兼容旧客户端（带结构校验）
router.post('/venues', auth.validateAdminSession, function (req, res) {
  try {
    var data = req.body;
    var err = validateVenuesShape(data);
    if (err) return res.status(400).json({ success: false, error: err });
    store.write('campus_venues', data).then(function () {
      res.json({ success: true, message: 'Venues updated', data: data });
    }).catch(function (e) {
      res.status(500).json({ success: false, error: e.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload-venue
router.post('/upload-venue', auth.validateAdminSession, upload.uploadField.single('fieldImage'), upload.handleMulterError, function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    res.json({
      success: true,
      imagePath: '/assets/fields/' + req.file.filename,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
