/**
 * Chauka Licensing Server
 * =======================
 * A small standalone API that self-hosted restaurant installs "phone home"
 * to. Run this on YOUR server (Render / VPS / same VPS as the main app) and
 * point each restaurant install at it:
 *
 *   LICENSE_SERVER_URL=https://your-licensing-domain
 *   LICENSE_KEY=<a key you create here>
 *
 * License keys live in licensing-data/licenses.json. Manage them through the
 * admin page at the server root ("/") — mark a license PAID to keep a
 * restaurant working, or UNPAID to lock it at its next daily check.
 *
 * Run:  npm run start:license   (port 3100, override with LICENSE_PORT)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.LICENSE_PORT || process.env.PORT || 3100;

// Shared secret required for the admin endpoints (create/revoke keys).
// Set LICENSE_ADMIN_TOKEN on this server and send it as a Bearer token
// from the admin page (it prompts once). Keep /api/license/verify public.
const ADMIN_TOKEN = process.env.LICENSE_ADMIN_TOKEN || '';

const DATA_DIR = path.join(__dirname, 'licensing-data');
const KEYS_FILE = path.join(DATA_DIR, 'licenses.json');

// ─── Data store ──────────────────────────────────────────────────────────

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify({ nextId: 1, keys: [] }, null, 2));
    console.log('  Created licensing-data/licenses.json');
  }
}

function readKeys() {
  return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
}

function writeKeys(data) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
}

// ─── Key generation ──────────────────────────────────────────────────────

function generateKey() {
  // No ambiguous characters (I, O, 0, 1) so keys are easy to type/read aloud.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () => {
    const bytes = crypto.randomBytes(4);
    let s = '';
    for (let i = 0; i < 4; i++) s += alphabet[bytes[i] % alphabet.length];
    return s;
  };
  return `CHK-${group()}-${group()}-${group()}-${group()}`;
}

// ─── Middleware ──────────────────────────────────────────────────────────

app.use(express.json());

// ─── Admin auth ───────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized. Set LICENSE_ADMIN_TOKEN on this server and send it as a Bearer token.' });
  }
  next();
}

// ─── Verify endpoint (called by restaurant installs) ─────────────────────

// GET /api/license/verify?key=...&installId=...&hostname=...
app.get('/api/license/verify', (req, res) => {
  const { key, installId, hostname } = req.query || {};
  if (!key) return res.status(400).json({ valid: false, reason: 'Missing license key' });

  const data = readKeys();
  const entry = data.keys.find((k) => k.key === key);
  if (!entry) return res.json({ valid: false, reason: 'Unknown license key' });
  if (!entry.active) {
    return res.json({
      valid: false,
      reason: entry.paid === false ? 'License not paid — contact your provider' : 'License revoked',
    });
  }

  const expiresAt = entry.expiresAt ? new Date(entry.expiresAt).getTime() : Infinity;
  if (expiresAt <= Date.now()) {
    return res.json({ valid: false, reason: 'License expired on ' + entry.expiresAt });
  }

  // Record where this key is being used (handy for support calls)
  entry.lastSeen = {
    at: new Date().toISOString(),
    installId: installId || '',
    hostname: hostname || '',
  };
  writeKeys(data);

  res.json({
    valid: true,
    expiresAt: entry.expiresAt,
    restaurant: entry.restaurant,
    plan: entry.plan || 'standard',
  });
});

// ─── Admin endpoints ─────────────────────────────────────────────────────

// GET /api/licenses — list all keys (admin)
app.get('/api/licenses', requireAdmin, (req, res) => {
  const data = readKeys();
  res.json(
    data.keys.map(({ id, restaurant, plan, key, active, paid, expiresAt, createdAt, lastSeen }) => ({
      id,
      restaurant,
      plan,
      key,
      active,
      paid: paid !== false,
      expiresAt,
      createdAt,
      lastSeen,
    }))
  );
});

// POST /api/licenses — create a new key { restaurant, plan?, days } (admin)
app.post('/api/licenses', requireAdmin, (req, res) => {
  const { restaurant, plan, days } = req.body || {};
  if (!restaurant) return res.status(400).json({ error: 'restaurant is required' });

  const daysNum = parseInt(days, 10) || 30;
  const data = readKeys();
  const entry = {
    id: data.nextId,
    key: generateKey(),
    restaurant: String(restaurant),
    plan: plan || 'standard',
    active: true,
    paid: true,
    days: daysNum,
    expiresAt: new Date(Date.now() + daysNum * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    lastSeen: null,
  };

  data.nextId += 1;
  data.keys.push(entry);
  writeKeys(data);

  console.log(`  License #${entry.id} created for ${entry.restaurant}: ${entry.key} (expires ${entry.expiresAt})`);
  res.status(201).json(entry);
});

// POST /api/licenses/:id/paid — confirm payment; extends the expiry by {days}
app.post('/api/licenses/:id/paid', requireAdmin, (req, res) => {
  const data = readKeys();
  const entry = data.keys.find((k) => k.id === parseInt(req.params.id, 10));
  if (!entry) return res.status(404).json({ error: 'License not found' });

  const days = parseInt((req.body || {}).days, 10) || 30;
  const base = Math.max(Date.now(), entry.expiresAt ? new Date(entry.expiresAt).getTime() : Date.now());
  entry.expiresAt = new Date(base + days * 86400000).toISOString();
  entry.paid = true;
  entry.active = true;
  writeKeys(data);

  console.log(`  License #${entry.id} marked PAID — ${entry.restaurant} (extended ${days}d, expires ${entry.expiresAt})`);
  res.json(entry);
});

// POST /api/licenses/:id/unpaid — mark as not paid; locks at the restaurant's next check
app.post('/api/licenses/:id/unpaid', requireAdmin, (req, res) => {
  const data = readKeys();
  const entry = data.keys.find((k) => k.id === parseInt(req.params.id, 10));
  if (!entry) return res.status(404).json({ error: 'License not found' });
  entry.paid = false;
  entry.active = false;
  writeKeys(data);
  console.log(`  License #${entry.id} marked UNPAID — ${entry.restaurant} (locks at next check)`);
  res.json(entry);
});

// DELETE /api/licenses/:id — permanently remove a license
app.delete('/api/licenses/:id', requireAdmin, (req, res) => {
  const data = readKeys();
  const idx = data.keys.findIndex((k) => k.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ error: 'License not found' });
  const removed = data.keys.splice(idx, 1)[0];
  writeKeys(data);
  console.log(`  License #${removed.id} DELETED — ${removed.restaurant}`);
  res.json(removed);
});

// GET /health — simple health check
app.get('/health', (req, res) => res.json({ ok: true, service: 'chauka-licensing' }));

// ─── Admin page ──────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chauka — License Manager</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #faf7f2; color: #1c1917; padding: 32px 20px; }
  .wrap { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 4px; }
  .sub { color: #78716c; font-size: 0.9rem; margin-bottom: 24px; }
  .card { background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .card h2 { font-size: 1rem; font-weight: 700; margin-bottom: 14px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; }
  input, select, button { font-family: inherit; font-size: 0.88rem; padding: 10px 12px; border-radius: 8px; border: 1px solid #d6d3d1; outline: none; }
  input:focus, select:focus { border-color: #d97706; }
  input[type=text] { flex: 1; min-width: 160px; }
  button { cursor: pointer; font-weight: 600; transition: all 0.15s; }
  .btn-primary { background: #d97706; border-color: #d97706; color: #fff; }
  .btn-primary:hover { background: #b45309; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #f5f5f4; vertical-align: middle; }
  th { color: #78716c; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; }
  .badge.on { background: #dcfce7; color: #166534; }
  .badge.off { background: #fee2e2; color: #b91c1c; }
  .badge.warn { background: #fef3c7; color: #92400e; }
  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; background: #faf7f2; padding: 2px 6px; border-radius: 4px; }
  .btn-sm { padding: 6px 10px; font-size: 0.78rem; border-color: #d6d3d1; background: #fff; }
  .btn-sm:hover { background: #f5f5f4; }
  .btn-paid { background: #dcfce7; border-color: #bbf7d0; color: #166534; }
  .btn-paid:hover { background: #bbf7d0; }
  .btn-unpaid { background: #fee2e2; border-color: #fecaca; color: #b91c1c; }
  .btn-unpaid:hover { background: #fecaca; }
  .btn-danger { color: #b91c1c; }
  .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
  .card-head h2 { margin-bottom: 0; }
  .extend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #78716c; }
  .empty { color: #a8a29e; text-align: center; padding: 20px; }
  .toast { position: fixed; bottom: 20px; right: 20px; background: #1c1917; color: #fff; padding: 12px 18px; border-radius: 8px; font-size: 0.85rem; opacity: 0; transition: opacity 0.25s; z-index: 10; }
  .toast.show { opacity: 1; }
</style>
</head>
<body>
<div class="wrap">
  <h1>🔑 Chauka License Manager</h1>
  <p class="sub">They pay → click <b>✅ Confirm paid</b> and their system keeps working. They don't pay → click <b>⛔ Mark unpaid</b> and their system locks at its next daily check. Keys are stored in <span class="mono">licensing-data/licenses.json</span>.</p>

  <div class="card">
    <h2>Create License (new paid subscription)</h2>
    <div class="row">
      <input type="text" id="restaurant" placeholder="Restaurant name" autocomplete="off">
      <select id="plan">
        <option value="standard">Standard</option>
        <option value="premium">Premium</option>
      </select>
      <select id="days">
        <option value="30">30 days</option>
        <option value="90">90 days</option>
        <option value="365">1 year</option>
      </select>
      <button class="btn-primary" onclick="createLicense()">Generate Key</button>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Licenses</h2>
      <div class="extend-row">
        <span>Confirm paid extends by</span>
        <select id="extendDays">
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </select>
      </div>
    </div>
    <table>
      <thead><tr><th>ID</th><th>Restaurant</th><th>Key</th><th>Plan</th><th>Status</th><th>Paid until</th><th>Last seen</th><th>Actions</th></tr></thead>
      <tbody id="rows"><tr><td colspan="8" class="empty">Loading…</td></tr></tbody>
    </table>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
  var adminToken = localStorage.getItem('chauka_admin_token') || '';
  function getToken() {
    if (!adminToken) {
      adminToken = prompt('Admin token (the LICENSE_ADMIN_TOKEN value):');
      if (adminToken) localStorage.setItem('chauka_admin_token', adminToken);
    }
    return adminToken;
  }
  async function api(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { 'Authorization': 'Bearer ' + getToken() });
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.removeItem('chauka_admin_token');
      adminToken = '';
      toast('Invalid admin token');
      throw new Error(data.error || 'Unauthorized');
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function statusOf(k) {
    if (k.paid === false) return { label: 'Unpaid', cls: 'off' };
    if (!k.active) return { label: 'Revoked', cls: 'off' };
    if (new Date(k.expiresAt).getTime() <= Date.now()) return { label: 'Expired', cls: 'warn' };
    return { label: 'Paid', cls: 'on' };
  }
  async function load() {
    const keys = await api('/api/licenses');
    const tbody = document.getElementById('rows');
    if (!keys.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No licenses yet — create your first one above.</td></tr>'; return; }
    tbody.innerHTML = keys.map((k) => \`
      <tr>
        <td>\${k.id}</td>
        <td>\${esc(k.restaurant)}</td>
        <td class="mono">\${k.key}</td>
        <td>\${esc(k.plan)}</td>
        <td><span class="badge \${statusOf(k).cls}">\${statusOf(k).label}</span></td>
        <td>\${new Date(k.expiresAt).toLocaleDateString()}</td>
        <td>\${k.lastSeen ? new Date(k.lastSeen.at).toLocaleString() : '—'}</td>
        <td>
          <button class="btn-sm btn-paid" onclick="paid(\${k.id})" title="Extends expiry by the selected period">✅ Confirm paid</button>
          <button class="btn-sm btn-unpaid" onclick="unpaid(\${k.id})" title="Locks their system at the next check">⛔ Unpaid</button>
          <button class="btn-sm btn-danger" onclick="del(\${k.id})" title="Delete license">🗑</button>
        </td>
      </tr>\`).join('');
  }
  async function createLicense() {
    const restaurant = document.getElementById('restaurant').value.trim();
    if (!restaurant) { toast('Enter a restaurant name'); return; }
    const body = {
      restaurant,
      plan: document.getElementById('plan').value,
      days: parseInt(document.getElementById('days').value, 10),
    };
    const key = await api('/api/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    toast('Created key for ' + key.restaurant);
    document.getElementById('restaurant').value = '';
    await load();
  }
  async function paid(id) {
    const days = parseInt(document.getElementById('extendDays').value, 10);
    await api('/api/licenses/' + id + '/paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    toast('Payment confirmed — license extended');
    await load();
  }
  async function unpaid(id) {
    if (!confirm('Mark this license as unpaid? Their system will lock at the next daily check.')) return;
    await api('/api/licenses/' + id + '/unpaid', { method: 'POST' });
    toast('Marked unpaid — will lock at next check');
    await load();
  }
  async function del(id) {
    if (!confirm('Permanently delete this license? Their system will lock at the next check. Prefer \"Mark unpaid\" unless you really want to remove it.')) return;
    await api('/api/licenses/' + id, { method: 'DELETE' });
    toast('License deleted');
    await load();
  }
  load();
</script>
</body>
</html>`);
});

// ─── Start ───────────────────────────────────────────────────────────────

ensureData();
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ================================================');
  console.log('     CHAUKA LICENSING SERVER');
  console.log('     http://0.0.0.0:' + PORT);
  console.log('  ================================================');
  console.log('');
  console.log('  Admin page: http://localhost:' + PORT + '/');
  console.log('  Verify:     GET /api/license/verify?key=...&installId=...');
  console.log('');
});
