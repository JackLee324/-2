// server/routes/curriculum.js
var express = require('express');
var router = express.Router();
var store = require('../store');
var auth = require('../middleware/auth');

var VALID_TABS = ['prek', 'k', 'climbing'];

// GET /api/curriculum — 所有 tab
router.get('/curriculum', function (req, res) {
  try {
    var data = store.read('curriculum');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/curriculum/:tab
router.get('/curriculum/:tab', function (req, res) {
  try {
    var tab = req.params.tab;
    if (!VALID_TABS.includes(tab)) {
      return res.status(400).json({ success: false, error: 'Invalid tab. Use: prek, k, climbing' });
    }
    var data = store.read('curriculum');
    res.json({ success: true, data: data[tab] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/curriculum/:tab
router.put('/curriculum/:tab', auth.validateAdminSession, function (req, res) {
  try {
    var tab = req.params.tab;
    if (!VALID_TABS.includes(tab)) {
      return res.status(400).json({ success: false, error: 'Invalid tab' });
    }
    var rows = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, error: 'Body must be an array of rows' });
    }
    var data = store.read('curriculum');
    data[tab] = rows;
    store.write('curriculum', data);
    res.json({ success: true, message: tab + ' updated with ' + rows.length + ' rows' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/curriculum/:tab
router.post('/curriculum/:tab', auth.validateAdminSession, function (req, res) {
  try {
    var tab = req.params.tab;
    if (!VALID_TABS.includes(tab)) {
      return res.status(400).json({ success: false, error: 'Invalid tab. Use: prek, k, climbing' });
    }
    var newRow = req.body;
    if (!newRow || !newRow.week || !newRow.month || !newRow.unit || !newRow.subunit) {
      return res.status(400).json({ success: false, error: 'Missing required fields: week, month, unit, subunit' });
    }
    var data = store.read('curriculum');
    var cleanRow = {
      week: String(newRow.week),
      month: String(newRow.month),
      unit: String(newRow.unit),
      subunit: String(newRow.subunit || ''),
      wd: String(newRow.wd || ''),
      events: String(newRow.events || ''),
      bgColor: String(newRow.bgColor || ''),
      textColor: String(newRow.textColor || '')
    };
    if (newRow.holiday) cleanRow.holiday = String(newRow.holiday);
    if (newRow.semester) cleanRow.semester = String(newRow.semester);
    data[tab].push(cleanRow);
    store.write('curriculum', data);
    res.json({ success: true, row: cleanRow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/curriculum/:tab/:week
router.delete('/curriculum/:tab/:week', auth.validateAdminSession, function (req, res) {
  try {
    var tab = req.params.tab;
    var week = req.params.week;
    if (!VALID_TABS.includes(tab)) {
      return res.status(400).json({ success: false, error: 'Invalid tab' });
    }
    var data = store.read('curriculum');
    var idx = data[tab].findIndex(function (row) {
      return row.week === week || (row.holiday && row.holiday === week) || (row.semester && row.semester === week);
    });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Row not found' });
    }
    var deleted = data[tab].splice(idx, 1)[0];
    store.write('curriculum', data);
    res.json({ success: true, deleted: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
