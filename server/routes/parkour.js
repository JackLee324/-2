// server/routes/parkour.js
var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var store = require('../store');
var auth = require('../middleware/auth');
var upload = require('../middleware/upload');

var PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// GET /api/parkour
router.get('/parkour', function (req, res) {
  try {
    var data = store.read('morning_parkour');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/parkour
router.put('/parkour', auth.validateAdminSession, function (req, res) {
  try {
    var rows = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, error: 'Body must be an array of parkour rows' });
    }
    store.write('morning_parkour', rows);
    res.json({ success: true, message: 'Parkour updated with ' + rows.length + ' rows' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload-parkour
router.post('/upload-parkour', auth.validateAdminSession, upload.uploadParkourImage.single('trackImage'), upload.handleMulterError, function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    res.json({
      success: true,
      imagePath: '/assets/parkour/' + req.file.filename,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/parkour-image — 路径遍历校验（修复 #3）
router.delete('/parkour-image', auth.validateAdminSession, function (req, res) {
  try {
    var imagePath = req.body.imagePath;
    if (!imagePath) return res.status(400).json({ success: false, error: 'imagePath required' });
    var resolved = path.resolve(PUBLIC_DIR, '.' + imagePath.replace(/\\/g, '/'));
    if (resolved.indexOf(path.resolve(PUBLIC_DIR)) !== 0) {
      return res.status(400).json({ success: false, error: 'Invalid image path' });
    }
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/parkour-videos
router.get('/parkour-videos', function (req, res) {
  try {
    var data = store.read('parkour_videos');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload-parkour-video
router.post('/upload-parkour-video', auth.validateAdminSession, upload.uploadParkourVideo.single('videoFile'), upload.handleMulterError, function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file received' });
    }
    var title = req.body.title;
    var description = req.body.description;
    var item = {
      id: 'pvid' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title || '未命名视频',
      description: description || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      uploadTime: new Date().toISOString()
    };
    var videos = store.read('parkour_videos');
    videos.unshift(item);
    store.write('parkour_videos', videos);
    res.json({ success: true, item: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/parkour-video/:id
router.delete('/parkour-video/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var videos = store.read('parkour_videos');
    var idx = videos.findIndex(function (v) { return v.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    var deleted = videos.splice(idx, 1)[0];
    store.write('parkour_videos', videos);
    var fullPath = path.join(PUBLIC_DIR, 'assets', 'parkour-videos', deleted.filename);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    res.json({ success: true, deleted: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
