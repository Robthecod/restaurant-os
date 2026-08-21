// Smoke test for the restaurant-local system.
// Boots the real server on a random port (licensing force-disabled so the
// test never depends on a licensing server) and verifies every app screen,
// shared assets, key APIs, legacy redirects, and 404 handling.
// Uses only Node built-ins (node:test) — no extra dependencies.
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 3300 + Math.floor(Math.random() * 800);
const BASE = `http://localhost:${PORT}`;
const SERVER = path.join(__dirname, '..', 'server.js');

let child;

function waitForServer() {
  const deadline = Date.now() + 15000;
  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) return reject(new Error('server did not start in time'));
      try {
        const res = await fetch(`${BASE}/health`);
        if (res.ok) return resolve();
      } catch {
        /* not up yet */
      }
      setTimeout(poll, 250);
    };
    poll();
  });
}

before(async () => {
  child = spawn(process.execPath, [SERVER], {
    // Clear license vars so the test is deterministic (no phone-home needed)
    env: { ...process.env, PORT: String(PORT), LICENSE_KEY: '', LICENSE_SERVER_URL: '' },
    stdio: 'ignore',
  });
  await waitForServer();
});

after(() => {
  if (child) child.kill();
});

test('health endpoint responds', async () => {
  const res = await fetch(`${BASE}/health`);
  assert.strictEqual(res.status, 200);
});

test('serves every app screen', async () => {
  const screens = [
    '/app/hub/',
    '/app/waiter/?table=01',
    '/app/kitchen/',
    '/app/manager/',
    '/app/customer/?table=01',
  ];
  for (const screen of screens) {
    const res = await fetch(`${BASE}${screen}`);
    assert.strictEqual(res.status, 200, `${screen} should be served`);
  }
});

test('serves shared assets', async () => {
  for (const asset of ['/css/style.css', '/js/motion.js', '/manifest.json', '/sw.js']) {
    const res = await fetch(`${BASE}${asset}`);
    assert.strictEqual(res.status, 200, `${asset} should be served`);
  }
});

test('legacy /app/*.html URLs redirect to the new folders', async () => {
  const res = await fetch(`${BASE}/app/waiter.html?table=01`, { redirect: 'manual' });
  assert.strictEqual(res.status, 301);
  assert.strictEqual(res.headers.get('location'), '/app/waiter/?table=01');
});

test('licensing is disabled when no key is configured', async () => {
  const res = await fetch(`${BASE}/api/license/status`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.licensingEnabled, false);
  assert.strictEqual(body.locked, false);
});

test('menu and analytics APIs respond', async () => {
  for (const api of ['/api/menu', '/api/analytics', '/api/orders']) {
    const res = await fetch(`${BASE}${api}`);
    assert.strictEqual(res.status, 200, `${api} should respond`);
  }
});

test('ingredient request endpoint validates input', async () => {
  const res = await fetch(`${BASE}/api/ingredient-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredient: 'Onion' }),
  });
  assert.strictEqual(res.status, 400);
});

test('help report endpoint validates input', async () => {
  const res = await fetch(`${BASE}/api/help-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Broken printer' }),
  });
  assert.strictEqual(res.status, 400);
});

test('loyalty APIs respond and validate input', async () => {
  const settings = await fetch(`${BASE}/api/loyalty/settings`);
  assert.strictEqual(settings.status, 200);
  const body = await settings.json();
  assert.ok(body.pointsPerHundred > 0, 'loyalty settings expose earning rules');
  assert.ok(Array.isArray(body.tiers) && body.tiers.length >= 2, 'settings define tiers');

  const noPhone = await fetch(`${BASE}/api/loyalty/status`);
  assert.strictEqual(noPhone.status, 400);

  const badRegister = await fetch(`${BASE}/api/loyalty/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'No Phone' }),
  });
  assert.strictEqual(badRegister.status, 400);
});

test('floor map API saves and serves a map', async () => {
  const save = await fetch(`${BASE}/api/map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      width: 800,
      height: 500,
      image: null,
      tables: [{ id: 't1', label: '12', x: 50, y: 50, w: 8, h: 8, shape: 'circle' }],
    }),
  });
  assert.strictEqual(save.status, 200);
  const saved = await save.json();
  assert.ok(saved.map.tables.length === 1, 'map should save tables');
  assert.strictEqual(saved.map.tables[0].label, '12');

  const get = await fetch(`${BASE}/api/map`);
  assert.strictEqual(get.status, 200);
  const body = await get.json();
  assert.strictEqual(body.map.tables[0].label, '12');

  // Reset the map so test runs leave the data file clean
  await fetch(`${BASE}/api/map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ width: 800, height: 500, image: null, tables: [] }),
  });
});

test('table session APIs work (assign → close)', async () => {
  const assign = await fetch(`${BASE}/api/tables/99/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9999900000', name: 'Smoke Test' }),
  });
  assert.strictEqual(assign.status, 201);

  const badAssign = await fetch(`${BASE}/api/tables/99/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '' }),
  });
  assert.strictEqual(badAssign.status, 400);

  const list = await fetch(`${BASE}/api/tables`);
  assert.strictEqual(list.status, 200);
  const body = await list.json();
  assert.ok(body.sessions.some((s) => s.tableNumber === '99'), 'session should be listed');

  const close = await fetch(`${BASE}/api/tables/99/close`, { method: 'POST' });
  assert.strictEqual(close.status, 200);
  const closed = await close.json();
  assert.strictEqual(closed.closed, true);

  // /clear removes a session without counting a visit
  await fetch(`${BASE}/api/tables/99/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9999900000' }),
  });
  const clear = await fetch(`${BASE}/api/tables/99/clear`, { method: 'POST' });
  assert.strictEqual(clear.status, 200);
  const cleared = await clear.json();
  assert.strictEqual(cleared.cleared, true);

  const afterClear = await fetch(`${BASE}/api/tables`);
  const afterBody = await afterClear.json();
  assert.ok(!afterBody.sessions.some((s) => s.tableNumber === '99'), 'session should be gone after clear');
});

test('returns 404 for unknown API routes', async () => {
  const res = await fetch(`${BASE}/api/nope`);
  assert.strictEqual(res.status, 404);
});
