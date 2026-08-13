// server/routes/admin.js
var express = require('express');
var router = express.Router();
var config = require('../config');
var store = require('../store');
var auth = require('../middleware/auth');

// POST /api/admin/login — 速率限制
router.post('/admin/login', auth.rateLimitLogin, function (req, res) {
  try {
    var password = req.body.password;
    if (password === config.ADMIN_PASSWORD) {
      res.json({ success: true, token: config.ADMIN_TOKEN });
    } else {
      res.status(401).json({ success: false, error: '安全密码错误，请重新输入' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/change-password — 持久化到 admin_auth.json，重启后仍生效
router.post('/admin/change-password', auth.validateAdminSession, function (req, res) {
  try {
    var oldPassword = req.body.oldPassword;
    var newPassword = req.body.newPassword;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '旧密码和新密码均不能为空' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码长度至少6位' });
    }
    if (oldPassword !== config.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: '旧密码错误' });
    }
    store.mutate('admin_auth', function (authData) {
      authData.adminPassword = newPassword;
      return authData;
    }).then(function () {
      config.ADMIN_PASSWORD = newPassword; // 同步更新内存，立即生效
      res.json({ success: true, message: '密码修改成功，请重新登录' });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
