// Smoke test for the restaurant-public marketing site.
// Boots the real server on a random port and verifies the landing page,
// static assets, lead-capture API validation, and 404 handling.
// Uses only Node built-ins (node:test) — no extra dependencies.
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 3200 + Math.floor(Math.random() * 800);
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
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await waitForServer();
});

after(() => {
  if (child) child.kill();
});

test('serves the landing page', async () => {
  const res = await fetch(`${BASE}/`);
  assert.strictEqual(res.status, 200);
  const html = await res.text();
  assert.match(html, /Chauka/);
});

test('serves static assets', async () => {
  for (const asset of ['/css/style.css', '/js/motion.js', '/manifest.json', '/terms.html']) {
    const res = await fetch(`${BASE}${asset}`);
    assert.strictEqual(res.status, 200, `${asset} should be served`);
  }
});

test('demo endpoint rejects incomplete submissions', async () => {
  const res = await fetch(`${BASE}/api/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test' }),
  });
  assert.strictEqual(res.status, 400);
});

test('signup endpoint rejects incomplete submissions', async () => {
  const res = await fetch(`${BASE}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'x@x.com' }),
  });
  assert.strictEqual(res.status, 400);
});

test('returns 404 for unknown pages', async () => {
  const res = await fetch(`${BASE}/does-not-exist`);
  assert.strictEqual(res.status, 404);
});
