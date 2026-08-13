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
    store.mutate('olympic_gallery', function (gallery) {
      gallery.unshift(item);
      return gallery;
    }).then(function () {
      res.json({ success: true, item: item });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/gallery/:id — 白名单字段校验
router.put('/gallery/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var allowed = { caption: true, date: true };
    var updates = {};
    Object.keys(req.body).forEach(function (key) {
      if (allowed[key]) updates[key] = String(req.body[key]);
    });
    var updated = null;
    store.mutate('olympic_gallery', function (gallery) {
      var idx = gallery.findIndex(function (item) { return item.id === id; });
      if (idx === -1) return gallery;
      gallery[idx] = Object.assign({}, gallery[idx], updates, { id: id });
      updated = gallery[idx];
      return gallery;
    }).then(function () {
      if (!updated) return res.status(404).json({ success: false, error: 'Item not found' });
      res.json({ success: true, item: updated });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/gallery/:id
router.delete('/gallery/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var deleted = null;
    store.mutate('olympic_gallery', function (gallery) {
      var idx = gallery.findIndex(function (item) { return item.id === id; });
      if (idx === -1) return gallery;
      deleted = gallery.splice(idx, 1)[0];
      return gallery;
    }).then(function () {
      if (!deleted) return res.status(404).json({ success: false, error: 'Item not found' });
      var filePath = path.join(__dirname, '..', '..', 'public', 'assets', 'olympic', deleted.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error('[gallery] unlink failed:', e.message); }
      }
      res.json({ success: true, deleted: deleted });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
