// server/test/api.test.js — API 冒烟测试（零依赖，Node 原生 assert）
var http = require('http');
var assert = require('assert');

var BASE = 'http://localhost:3099';
// 凭据不写死在测试里：统一从 config 读取（即被测服务实际使用的那一份）
var ADMIN_TOKEN = '';
var ADMIN_PASSWORD = '';
var passed = 0;
var failed = 0;

function get(path, cb) {
  http.get(BASE + path, function (res) {
    var body = '';
    res.on('data', function (c) { body += c; });
    res.on('end', function () { cb(res.statusCode, body); });
  }).on('error', function (e) { cb(0, null, e.message); });
}

function request(method, path, data, headers, cb) {
  var payload = data ? JSON.stringify(data) : '';
  var hdrs = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
  if (payload) hdrs['Content-Length'] = Buffer.byteLength(payload);
  var opts = { method: method, headers: hdrs };
  var req = http.request(BASE + path, opts, function (res) {
    var body = '';
    res.on('data', function (c) { body += c; });
    res.on('end', function () { cb(res.statusCode, body); });
  });
  req.on('error', function (e) { cb(0, null, e.message); });
  if (payload) req.write(payload);
  req.end();
}

function post(path, data, cb) { request('POST', path, data, null, cb); }
function put(path, data, cb) { request('PUT', path, data, null, cb); }
function authPost(path, data, cb) { request('POST', path, data, { 'x-admin-token': ADMIN_TOKEN }, cb); }
function authPut(path, data, cb) { request('PUT', path, data, { 'x-admin-token': ADMIN_TOKEN }, cb); }
function authDel(path, cb) { request('DELETE', path, null, { 'x-admin-token': ADMIN_TOKEN }, cb); }

function test(name, fn) {
  try { fn(); passed++; console.log('  PASS: ' + name); }
  catch (e) { failed++; console.error('  FAIL: ' + name + ' — ' + e.message); }
}

function runTests() {
  console.log('\n=== API Smoke Tests ===\n');

  // 1. Curriculum
  get('/api/curriculum', function (code, body) {
    test('GET /api/curriculum returns 200', function () {
      assert.strictEqual(code, 200);
      var data = JSON.parse(body);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.prek);
      assert.ok(data.data.k);
      assert.ok(data.data.climbing);
    });

    // 2. Gallery
    get('/api/gallery', function (code, body) {
      test('GET /api/gallery returns 200', function () {
        assert.strictEqual(code, 200);
        var data = JSON.parse(body);
        assert.strictEqual(data.success, true);
        assert.ok(Array.isArray(data.data));
      });

      // 3. Parkour
      get('/api/parkour', function (code, body) {
        test('GET /api/parkour returns 200', function () {
          assert.strictEqual(code, 200);
          var data = JSON.parse(body);
          assert.strictEqual(data.success, true);
          assert.ok(Array.isArray(data.data));
        });

        // 4. Calendar
        get('/api/calendar', function (code, body) {
          test('GET /api/calendar returns 200', function () {
            assert.strictEqual(code, 200);
            var data = JSON.parse(body);
            assert.strictEqual(data.success, true);
            assert.ok(data.data.events);
            assert.ok(data.data.monthlyThemes);
            assert.ok(data.data.globalNotice);
          });

          // 4b. Calendar Classes (public read)
          get('/api/calendar/classes', function (code, body) {
            test('GET /api/calendar/classes returns 200', function () {
              assert.strictEqual(code, 200);
              var data = JSON.parse(body);
              assert.strictEqual(data.success, true);
              assert.ok(Array.isArray(data.data));
            });

            // 4c. Reservations by date (public read)
            get('/api/calendar/reservations?date=2026-08-05', function (code, body) {
              test('GET /api/calendar/reservations returns 200', function () {
                assert.strictEqual(code, 200);
                var data = JSON.parse(body);
                assert.strictEqual(data.success, true);
                assert.ok(Array.isArray(data.data));
              });

              // 4d. Create Reservation (auth required)
              authPost('/api/calendar/reservation', {
                date: '2026-08-05',
                venueId: 'outdoor-playground',
                className: 'K1',
                timeSlot: '9:00-10:00'
              }, function (code, body) {
                var data = JSON.parse(body);
                test('POST /api/calendar/reservation creates reservation', function () {
                  assert.strictEqual(code, 200);
                  assert.strictEqual(data.success, true);
                  assert.ok(data.reservation);
                  assert.ok(data.reservation.id);
                });

                var resId = data.reservation ? data.reservation.id : null;

                // 4e. Unauthorized create should fail
                post('/api/calendar/reservation', {
                  date: '2026-08-06',
                  venueId: 'sensory-gym',
                  className: 'K2',
                  timeSlot: '10:00-11:00'
                }, function (code, body) {
                  test('POST /api/calendar/reservation without auth returns 401', function () {
                    assert.strictEqual(code, 401);
                  });

                  // Continue with update/delete tests if reservation was created
                  function afterReservationTests() {
                    // 4h. Update Classes (admin auth)
                    authPut('/api/calendar/classes', ['K1', 'K2', 'K3'], function (code, body) {
                      test('PUT /api/calendar/classes updates classes', function () {
                        assert.strictEqual(code, 200);
                        var d = JSON.parse(body);
                        assert.strictEqual(d.success, true);
                        assert.deepStrictEqual(d.classes, ['K1', 'K2', 'K3']);
                      });

                      // 4i. Unauthorized classes update fails
                      put('/api/calendar/classes', ['X1'], function (code) {
                        test('PUT /api/calendar/classes without auth returns 401', function () {
                          assert.strictEqual(code, 401);
                        });

                        runRemainingTests(server);
                      });
                    });
                  }

                  if (resId) {
                    // 4f. Update Reservation
                    authPut('/api/calendar/reservation/' + resId, { className: 'K2' }, function (code, body) {
                      test('PUT /api/calendar/reservation/:id updates reservation', function () {
                        assert.strictEqual(code, 200);
                        var d = JSON.parse(body);
                        assert.strictEqual(d.success, true);
                        assert.strictEqual(d.reservation.className, 'K2');
                      });

                      // 4g. Delete Reservation
                      authDel('/api/calendar/reservation/' + resId, function (code, body) {
                        test('DELETE /api/calendar/reservation/:id deletes reservation', function () {
                          assert.strictEqual(code, 200);
                          var d = JSON.parse(body);
                          assert.strictEqual(d.success, true);
                        });

                        afterReservationTests();
                      });
                    });
                  } else {
                    afterReservationTests();
                  }
                });
              });
            });
          });
        });
      });
    });
  });
}

function runRemainingTests(server) {
  // 5. Venues
  get('/api/venues', function (code, body) {
    test('GET /api/venues returns 200', function () {
      assert.strictEqual(code, 200);
      var data = JSON.parse(body);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.coreVenues);
      assert.ok(data.data.auxVenues);
    });

    // 6. Login
    post('/api/admin/login', { password: ADMIN_PASSWORD }, function (code, body) {
      test('POST /api/admin/login correct password returns token', function () {
        assert.strictEqual(code, 200);
        var data = JSON.parse(body);
        assert.strictEqual(data.success, true);
        assert.ok(data.token);
      });

      // 7. Health
      get('/api/health', function (code, body) {
        test('GET /api/health returns ok', function () {
          assert.strictEqual(code, 200);
          var data = JSON.parse(body);
          assert.strictEqual(data.status, 'ok');
          assert.ok(data.uptime > 0);
        });

        console.log('\n' + passed + '/' + (passed + failed) + ' tests passed');
        server.close(function () { process.exit(failed > 0 ? 1 : 0); });
      });
    });
  });
}

// 测试隔离：使用临时数据目录，避免污染真实 server/data
var os = require('os');
var fs = require('fs');
var path = require('path');
var TEST_DATA_DIR = path.join(os.tmpdir(), 'cms-test-data-' + process.pid);
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.DATA_DIR = TEST_DATA_DIR;

// Start server on test port
var app = require('../index.js');
app.set('port', 3099);

// 取被测服务实际生效的凭据（同一进程、同一 config 实例）
var config = require('../config');
ADMIN_PASSWORD = config.ADMIN_PASSWORD;
ADMIN_TOKEN = config.ADMIN_TOKEN;

var server = app.listen(3099, function () {
  runTests();
});

// 测试结束后清理临时目录
process.on('exit', function () {
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true }); } catch (e) {}
});
