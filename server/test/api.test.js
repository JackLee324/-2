// server/test/api.test.js — API 冒烟测试（零依赖，Node 原生 assert）
var http = require('http');
var assert = require('assert');

var BASE = 'http://localhost:3099';
var passed = 0;
var failed = 0;

function get(path, cb) {
  http.get(BASE + path, function (res) {
    var body = '';
    res.on('data', function (c) { body += c; });
    res.on('end', function () { cb(res.statusCode, body); });
  }).on('error', function (e) { cb(0, null, e.message); });
}

function post(path, data, cb) {
  var payload = JSON.stringify(data);
  var opts = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length } };
  var req = http.request(BASE + path, opts, function (res) {
    var body = '';
    res.on('data', function (c) { body += c; });
    res.on('end', function () { cb(res.statusCode, body); });
  });
  req.on('error', function (e) { cb(0, null, e.message); });
  req.write(payload);
  req.end();
}

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
            post('/api/admin/login', { password: '123456' }, function (code, body) {
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
        });
      });
    });
  });
}

// Start server on test port
var app = require('../index.js');
app.set('port', 3099);
var server = app.listen(3099, function () {
  runTests();
});
