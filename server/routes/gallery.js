// server/routes/gallery.js
var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var store = require('../store');
var auth = require('../middleware/auth');
var upload = require('../middleware/upload');

// GET /api/gallery
router.get('/gallery', function (req, res) {
  try {
    var items = store.read('olympic_gallery');
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload
router.post('/upload', auth.validateAdminSession, upload.uploadGallery.single('file'), upload.handleMulterError, function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file received' });
    }
    var isVideo = /mp4|mov|webm/i.test(path.extname(req.file.originalname));
    var item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      filename: req.file.filename,
      originalName: req.file.originalname,
      type: isVideo ? 'video' : 'image',
      caption: req.body.caption || '',
      date: req.body.date || '',
      uploadedAt: new Date().toISOString()
    };
    var gallery = store.read('olympic_gallery');
    gallery.unshift(item);
    store.write('olympic_gallery', gallery);
    res.json({ success: true, item: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/gallery/:id — 白名单字段校验（修复 #7）
router.put('/gallery/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var gallery = store.read('olympic_gallery');
    var idx = gallery.findIndex(function (item) { return item.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    var allowed = { caption: true, date: true };
    var updates = {};
    Object.keys(req.body).forEach(function (key) {
      if (allowed[key]) updates[key] = String(req.body[key]);
    });
    gallery[idx] = Object.assign({}, gallery[idx], updates, { id: id });
    store.write('olympic_gallery', gallery);
    res.json({ success: true, item: gallery[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/gallery/:id
router.delete('/gallery/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var gallery = store.read('olympic_gallery');
    var idx = gallery.findIndex(function (item) { return item.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    var deleted = gallery.splice(idx, 1)[0];
    store.write('olympic_gallery', gallery);
    var filePath = path.join(__dirname, '..', '..', 'public', 'assets', 'olympic', deleted.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true, deleted: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
