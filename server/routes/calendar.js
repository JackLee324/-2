// server/routes/calendar.js
var express = require('express');
var router = express.Router();
var store = require('../store');
var auth = require('../middleware/auth');

var EVENT_TYPE_COLORS = {
  ParentEvent:   { bg: '#9B59B6', text: '#ffffff' },
  SchoolDay:     { bg: '#F1C40F', text: '#333333' },
  OnCampusEvent: { bg: '#E91E8C', text: '#ffffff' },
  PDDay:         { bg: '#95A5A6', text: '#ffffff' },
  Holiday:       { bg: '#27AE60', text: '#ffffff' }
};

var VALID_TYPES = Object.keys(EVENT_TYPE_COLORS);
var VALID_NOTICE_TYPES = ['danger', 'info', 'success'];

// GET /api/calendar
router.get('/calendar', function (req, res) {
  try {
    var data = store.read('academic_calendar');
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/time
router.get('/time', function (req, res) {
  var now = new Date();
  res.json({
    success: true,
    time: now.toISOString(),
    timestamp: now.getTime()
  });
});

// POST /api/calendar/event
router.post('/calendar/event', auth.validateAdminSession, function (req, res) {
  try {
    var date = req.body.date, endDate = req.body.endDate, title = req.body.title;
    var titleEn = req.body.titleEn, type = req.body.type, description = req.body.description;
    var backgroundColor = req.body.backgroundColor, textColor = req.body.textColor;
    if (!date || !title || !type) {
      return res.status(400).json({ success: false, error: 'date, title, and type are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type. Use: ' + VALID_TYPES.join(', ') });
    }
    var cal = store.read('academic_calendar');
    var newEvent = {
      id: 'evt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: date,
      endDate: endDate || date,
      title: title || '',
      titleEn: titleEn || '',
      type: type,
      description: description || '',
      backgroundColor: backgroundColor || EVENT_TYPE_COLORS[type].bg || '#999999',
      textColor: textColor || EVENT_TYPE_COLORS[type].text || '#ffffff'
    };
    cal.events.push(newEvent);
    cal.events.sort(function (a, b) { return a.date.localeCompare(b.date); });
    store.write('academic_calendar', cal);
    res.json({ success: true, event: newEvent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/event/:id — 更新后排序（修复 #10）
router.put('/calendar/event/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var cal = store.read('academic_calendar');
    var idx = cal.events.findIndex(function (e) { return e.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    if (req.body.type && !VALID_TYPES.includes(req.body.type)) {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }
    cal.events[idx] = Object.assign({}, cal.events[idx], req.body, { id: id });
    cal.events.sort(function (a, b) { return a.date.localeCompare(b.date); });
    store.write('academic_calendar', cal);
    res.json({ success: true, event: cal.events[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/calendar/event/:id
router.delete('/calendar/event/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var cal = store.read('academic_calendar');
    var idx = cal.events.findIndex(function (e) { return e.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    var deleted = cal.events.splice(idx, 1)[0];
    store.write('academic_calendar', cal);
    res.json({ success: true, deleted: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/themes
router.put('/calendar/themes', auth.validateAdminSession, function (req, res) {
  try {
    var themes = req.body;
    if (!Array.isArray(themes)) {
      return res.status(400).json({ success: false, error: 'Themes must be an array' });
    }
    var cal = store.read('academic_calendar');
    cal.monthlyThemes = themes;
    store.write('academic_calendar', cal);
    res.json({ success: true, themes: cal.monthlyThemes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/notice
router.put('/calendar/notice', auth.validateAdminSession, function (req, res) {
  try {
    var isActive = req.body.isActive;
    var type = req.body.type;
    var content = req.body.content;
    if (type && !VALID_NOTICE_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type. Use: ' + VALID_NOTICE_TYPES.join(', ') });
    }
    var cal = store.read('academic_calendar');
    cal.globalNotice = {
      isActive: Boolean(isActive),
      type: VALID_NOTICE_TYPES.includes(type) ? type : 'info',
      content: String(content || '')
    };
    store.write('academic_calendar', cal);
    res.json({ success: true, globalNotice: cal.globalNotice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Classes ──

// GET /api/calendar/classes
router.get('/calendar/classes', function (req, res) {
  try {
    var cal = store.read('academic_calendar');
    res.json({ success: true, data: cal.classes || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/classes
router.put('/calendar/classes', auth.validateAdminSession, function (req, res) {
  try {
    var classes = req.body;
    if (!Array.isArray(classes)) {
      return res.status(400).json({ success: false, error: 'Classes must be an array' });
    }
    var cal = store.read('academic_calendar');
    cal.classes = classes;
    store.write('academic_calendar', cal);
    res.json({ success: true, classes: cal.classes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Venue Reservations ──

// GET /api/calendar/reservations?date=YYYY-MM-DD
router.get('/calendar/reservations', function (req, res) {
  try {
    var date = req.query.date;
    var cal = store.read('academic_calendar');
    var reservations = cal.venueReservations || [];
    if (date) {
      reservations = reservations.filter(function (r) { return r.date === date; });
    }
    reservations.sort(function (a, b) { return a.timeSlot.localeCompare(b.timeSlot); });
    res.json({ success: true, data: reservations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/calendar/reservation
router.post('/calendar/reservation', auth.validateAdminSession, function (req, res) {
  try {
    var date = req.body.date, venueId = req.body.venueId;
    var className = req.body.className, timeSlot = req.body.timeSlot;
    if (!date || !venueId || !className || !timeSlot) {
      return res.status(400).json({ success: false, error: 'date, venueId, className, and timeSlot are required' });
    }
    var cal = store.read('academic_calendar');
    if (!cal.venueReservations) cal.venueReservations = [];
    var newRes = {
      id: 'res' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: date,
      venueId: venueId,
      className: className,
      timeSlot: timeSlot
    };
    cal.venueReservations.push(newRes);
    cal.venueReservations.sort(function (a, b) {
      return a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot);
    });
    store.write('academic_calendar', cal);
    res.json({ success: true, reservation: newRes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/reservation/:id
router.put('/calendar/reservation/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var cal = store.read('academic_calendar');
    var reservations = cal.venueReservations || [];
    var idx = reservations.findIndex(function (r) { return r.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }
    reservations[idx] = Object.assign({}, reservations[idx], req.body, { id: id });
    reservations.sort(function (a, b) {
      return a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot);
    });
    store.write('academic_calendar', cal);
    res.json({ success: true, reservation: reservations[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/calendar/reservation/:id
router.delete('/calendar/reservation/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var cal = store.read('academic_calendar');
    var reservations = cal.venueReservations || [];
    var idx = reservations.findIndex(function (r) { return r.id === id; });
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }
    var deleted = reservations.splice(idx, 1)[0];
    store.write('academic_calendar', cal);
    res.json({ success: true, deleted: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
