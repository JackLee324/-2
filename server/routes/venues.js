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

// PUT /api/venues/core/:id
router.put('/venues/core/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid venue data' });
    }
    var db = store.read('campus_venues');
    var coreIdx = db.coreVenues.findIndex(function (v) { return v.id === id; });
    if (coreIdx < 0) {
      return res.status(404).json({ success: false, error: 'Core venue not found' });
    }
    db.coreVenues[coreIdx] = Object.assign({}, db.coreVenues[coreIdx], updates, { id: id });
    store.write('campus_venues', db);
    res.json({ success: true, message: 'Core venue updated', venue: db.coreVenues[coreIdx] });
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
    var db = store.read('campus_venues');
    var auxIdx = db.auxVenues.findIndex(function (v) { return v.id === id; });
    if (auxIdx < 0) {
      return res.status(404).json({ success: false, error: 'Auxiliary venue not found' });
    }
    db.auxVenues[auxIdx] = Object.assign({}, db.auxVenues[auxIdx], updates, { id: id });
    store.write('campus_venues', db);
    res.json({ success: true, message: 'Auxiliary venue updated', venue: db.auxVenues[auxIdx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/venues/aux/:id
router.delete('/venues/aux/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var db = store.read('campus_venues');
    var lenBefore = db.auxVenues.length;
    db.auxVenues = db.auxVenues.filter(function (v) { return v.id !== id; });
    if (db.auxVenues.length === lenBefore) {
      return res.status(404).json({ success: false, error: 'Auxiliary venue not found' });
    }
    store.write('campus_venues', db);
    res.json({ success: true, message: 'Auxiliary venue deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/venues — 合并原来的 POST+PUT 为单一入口（#8）
router.put('/venues', auth.validateAdminSession, function (req, res) {
  try {
    var data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid venues data' });
    }
    store.write('campus_venues', data);
    res.json({ success: true, message: 'Venues updated', data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/venues — 保留 POST 兼容旧客户端
router.post('/venues', auth.validateAdminSession, function (req, res) {
  try {
    var data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid venues data' });
    }
    store.write('campus_venues', data);
    res.json({ success: true, message: 'Venues updated', data: data });
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
