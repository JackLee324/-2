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
    store.mutate('academic_calendar', function (cal) {
      cal.events.push(newEvent);
      cal.events.sort(function (a, b) { return a.date.localeCompare(b.date); });
      return cal;
    }).then(function () {
      res.json({ success: true, event: newEvent });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/event/:id
router.put('/calendar/event/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    if (req.body.type && !VALID_TYPES.includes(req.body.type)) {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }
    var updatedEvent = null;
    store.mutate('academic_calendar', function (cal) {
      var idx = cal.events.findIndex(function (e) { return e.id === id; });
      if (idx === -1) return cal;
      cal.events[idx] = Object.assign({}, cal.events[idx], req.body, { id: id });
      cal.events.sort(function (a, b) { return a.date.localeCompare(b.date); });
      updatedEvent = cal.events[idx];
      return cal;
    }).then(function () {
      if (!updatedEvent) return res.status(404).json({ success: false, error: 'Event not found' });
      res.json({ success: true, event: updatedEvent });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/calendar/event/:id
router.delete('/calendar/event/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var deleted = null;
    store.mutate('academic_calendar', function (cal) {
      var idx = cal.events.findIndex(function (e) { return e.id === id; });
      if (idx === -1) return cal;
      deleted = cal.events.splice(idx, 1)[0];
      return cal;
    }).then(function () {
      if (!deleted) return res.status(404).json({ success: false, error: 'Event not found' });
      res.json({ success: true, deleted: deleted });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
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
    store.mutate('academic_calendar', function (cal) {
      cal.monthlyThemes = themes;
      return cal;
    }).then(function (newCal) {
      res.json({ success: true, themes: newCal.monthlyThemes });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
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
    store.mutate('academic_calendar', function (cal) {
      cal.globalNotice = {
        isActive: Boolean(isActive),
        type: VALID_NOTICE_TYPES.includes(type) ? type : 'info',
        content: String(content || '')
      };
      return cal;
    }).then(function (newCal) {
      res.json({ success: true, globalNotice: newCal.globalNotice });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
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
    store.mutate('academic_calendar', function (cal) {
      cal.classes = classes;
      return cal;
    }).then(function (newCal) {
      res.json({ success: true, classes: newCal.classes });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
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
    var newRes = {
      id: 'res' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: date,
      venueId: venueId,
      className: className,
      timeSlot: timeSlot
    };
    store.mutate('academic_calendar', function (cal) {
      if (!cal.venueReservations) cal.venueReservations = [];
      cal.venueReservations.push(newRes);
      cal.venueReservations.sort(function (a, b) {
        return a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot);
      });
      return cal;
    }).then(function () {
      res.json({ success: true, reservation: newRes });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/calendar/reservation/:id
router.put('/calendar/reservation/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var updatedRes = null;
    store.mutate('academic_calendar', function (cal) {
      var reservations = cal.venueReservations || [];
      var idx = reservations.findIndex(function (r) { return r.id === id; });
      if (idx === -1) return cal;
      reservations[idx] = Object.assign({}, reservations[idx], req.body, { id: id });
      reservations.sort(function (a, b) {
        return a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot);
      });
      updatedRes = reservations[idx];
      return cal;
    }).then(function () {
      if (!updatedRes) return res.status(404).json({ success: false, error: 'Reservation not found' });
      res.json({ success: true, reservation: updatedRes });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/calendar/reservation/:id
router.delete('/calendar/reservation/:id', auth.validateAdminSession, function (req, res) {
  try {
    var id = req.params.id;
    var deleted = null;
    store.mutate('academic_calendar', function (cal) {
      var reservations = cal.venueReservations || [];
      var idx = reservations.findIndex(function (r) { return r.id === id; });
      if (idx === -1) return cal;
      deleted = reservations.splice(idx, 1)[0];
      return cal;
    }).then(function () {
      if (!deleted) return res.status(404).json({ success: false, error: 'Reservation not found' });
      res.json({ success: true, deleted: deleted });
    }).catch(function (err) {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
