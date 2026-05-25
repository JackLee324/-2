// server/middleware/upload.js — Multer 配置集中管理
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var config = require('../config');

var PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function makeStorage(subdir, prefix) {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      var dir = path.join(PUBLIC_DIR, 'assets', subdir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname).toLowerCase();
      cb(null, prefix + Date.now() + ext);
    }
  });
}

var uploadGallery = multer({
  storage: makeStorage('olympic', ''),
  limits: { fileSize: config.UPLOAD_MAX_SIZE },
  fileFilter: function (req, file, cb) {
    var allowed = /\.(jpeg|jpg|png|webp|gif|heic|heif|mp4|mov|webm|avi|mkv)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('不支持的文件类型: ' + file.originalname));
  }
});

var uploadParkourImage = multer({
  storage: makeStorage('parkour', ''),
  limits: { fileSize: config.UPLOAD_MAX_SIZE },
  fileFilter: function (req, file, cb) {
    var allowed = /\.(jpeg|jpg|png|webp|gif|heic|heif)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('跑酷只支持图片文件'));
  }
});

var uploadParkourVideo = multer({
  storage: makeStorage('parkour-videos', ''),
  limits: { fileSize: config.PARKOUR_VIDEO_MAX_SIZE },
  fileFilter: function (req, file, cb) {
    var allowed = /\.(mp4|webm|mov|avi|mkv)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('只支持视频文件 (mp4, webm, mov)'));
  }
});

var uploadField = multer({
  storage: makeStorage('fields', 'field_'),
  limits: { fileSize: config.FIELD_UPLOAD_MAX_SIZE },
  fileFilter: function (req, file, cb) {
    var allowed = /\.(jpg|jpeg|png|webp)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('场地只支持图片文件 (jpg, jpeg, png, webp)'));
  }
});

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: '文件大小超过限制' });
    return res.status(400).json({ success: false, error: '上传错误: ' + err.message });
  }
  if (err) return res.status(400).json({ success: false, error: err.message });
  next();
}

module.exports = {
  uploadGallery: uploadGallery,
  uploadParkourImage: uploadParkourImage,
  uploadParkourVideo: uploadParkourVideo,
  uploadField: uploadField,
  handleMulterError: handleMulterError
};
