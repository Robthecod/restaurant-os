// ─── Load .env (git-ignored local overrides, zero dependencies) ──────────
(function loadEnv() {
  const fs = require('fs'), path = require('path');
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
})();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const KITCHEN_FILE = path.join(DATA_DIR, 'kitchen.json');
const LICENSE_FILE = path.join(DATA_DIR, 'license.json');

// Shared static assets for the app screens (style.css, motion.js, manifest,
// sw.js, icons) — served at root. The restaurant screens live in /app/.
const PUBLIC_DIR = path.join(__dirname, 'public');
const APP_DIR = path.join(__dirname, 'app');

// ─── File System Helpers ────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initDataFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    console.log(`  Created ${path.basename(filePath)}`);
  }
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ─── Per-Item Status Helpers ────────────────────────────────────────────

function deriveOrderStatus(items) {
  const statuses = items.map((i) => i.status || 'pending');
  const hasPending = statuses.some((s) => s === 'pending');
  const hasCooking = statuses.some((s) => s === 'cooking');
  const hasReady = statuses.some((s) => s === 'ready');

  if (statuses.every((s) => s === 'delivered')) return 'delivered';
  if (statuses.every((s) => s === 'ready' || s === 'delivered')) return 'ready';
  if (hasCooking) return 'cooking';
  if (hasPending) return 'pending';
  return 'pending';
}

function addPendingStatusToItems(items) {
  return items.map((item) => ({
    ...item,
    status: item.status || 'pending',
  }));
}

// ─── Initialize Data Store ──────────────────────────────────────────────

ensureDataDir();

initDataFile(MENU_FILE, {
  categories: {
    starters: [
      { id: 1, name: 'Crispy Corn', price: 89, available: true },
      { id: 2, name: 'Paneer Tikka', price: 299, available: true },
      { id: 3, name: 'Garlic Bread with Cheese', price: 239, available: true },
      { id: 4, name: 'Hara Bhara Kabab', price: 239, available: true },
      { id: 5, name: 'Masala Spring Rolls', price: 239, available: true },
      { id: 6, name: 'Mushroom Kurkure', price: 255, available: true },
      { id: 7, name: 'Nachos Supreme', price: 299, available: true },
      { id: 8, name: 'Sweet Potato Fries', price: 225, available: true },
      { id: 9, name: 'Chilli Paneer', price: 299, available: true },
      { id: 10, name: 'Veg Seekh Kabab', price: 255, available: true },
      { id: 11, name: 'Dahi Ke Kabab', price: 299, available: true },
      { id: 12, name: 'Spinach & Corn Soup', price: 195, available: true },
      { id: 13, name: 'Tomato Basil Soup', price: 179, available: true },
      { id: 14, name: 'Cheese Chilli Toast', price: 225, available: true },
    ],
    mains: [
      { id: 15, name: 'Veg Biryani', price: 359, available: true },
      { id: 16, name: 'Paneer Butter Masala', price: 359, available: true },
      { id: 17, name: 'Dal Makhani', price: 315, available: true },
      { id: 18, name: 'Shahi Paneer', price: 375, available: true },
      { id: 19, name: 'Kadai Vegetable', price: 329, available: true },
      { id: 20, name: 'Malai Kofta', price: 359, available: true },
      { id: 21, name: 'Dal Tadka', price: 285, available: true },
      { id: 22, name: 'Palak Paneer', price: 329, available: true },
      { id: 23, name: 'Paneer Tikka Masala', price: 375, available: true },
      { id: 24, name: 'Mix Veg Curry', price: 299, available: true },
      { id: 25, name: 'Aloo Gobi', price: 269, available: true },
      { id: 26, name: 'Bhindi Masala', price: 269, available: true },
      { id: 27, name: 'Jeera Rice', price: 179, available: true },
      { id: 28, name: 'Lemon Rice', price: 209, available: true },
      { id: 29, name: 'Veg Pulao', price: 299, available: true },
      { id: 30, name: 'Veg Pasta in White Sauce', price: 359, available: true },
      { id: 31, name: 'Veg Pasta in Red Sauce', price: 329, available: true },
      { id: 32, name: 'Veg Fried Rice', price: 299, available: true },
      { id: 33, name: 'Hakka Noodles', price: 299, available: true },
      { id: 34, name: 'Veg Manchurian Gravy', price: 299, available: true },
      { id: 35, name: 'Stuffed Paratha', price: 179, available: true },
      { id: 36, name: 'Butter Naan', price: 119, available: true },
      { id: 37, name: 'Special Veg Thali', price: 479, available: true },
      { id: 38, name: 'Veg Sizzler', price: 435, available: true },
    ],
    desserts: [
      { id: 39, name: 'Gulab Jamun (2 pcs)', price: 179, available: true },
      { id: 40, name: 'Gajar Ka Halwa', price: 195, available: true },
      { id: 41, name: 'Brownie with Ice Cream', price: 239, available: true },
      { id: 42, name: 'Mango Mousse', price: 225, available: true },
      { id: 43, name: 'Tiramisu', price: 255, available: true },
      { id: 44, name: 'Rasmalai', price: 209, available: true },
      { id: 45, name: 'Ice Cream (2 scoops)', price: 149, available: true },
      { id: 46, name: 'Sizzling Brownie', price: 269, available: true },
      { id: 47, name: 'Phirni', price: 179, available: true },
      { id: 48, name: 'Fresh Fruit Bowl', price: 209, available: true },
      { id: 49, name: 'Kulfi', price: 195, available: true },
      { id: 50, name: 'Cheesecake', price: 239, available: true },
    ],
    drinks: [
      { id: 51, name: 'Masala Chai', price: 119, available: true },
      { id: 52, name: 'Cold Coffee', price: 179, available: true },
      { id: 53, name: 'Mango Lassi', price: 209, available: true },
      { id: 54, name: 'Fresh Lime Soda', price: 119, available: true },
      { id: 55, name: 'Buttermilk (Chaas)', price: 105, available: true },
      { id: 56, name: 'Fruit Smoothie', price: 225, available: true },
      { id: 57, name: 'Coconut Water', price: 135, available: true },
      { id: 58, name: 'Soft Drinks', price: 59, available: true },
      { id: 59, name: 'Mint Lemonade', price: 135, available: true },
      { id: 60, name: 'Iced Tea', price: 149, available: true },
      { id: 61, name: 'Hot Chocolate', price: 195, available: true },
      { id: 62, name: 'Fresh Juice (Seasonal)', price: 179, available: true },
    ],
  },
});

initDataFile(ORDERS_FILE, { nextId: 1, orders: [] });
initDataFile(KITCHEN_FILE, { nextIngredientId: 1, nextReturnId: 1, nextHelpId: 1, ingredientRequests: [], returnedDishes: [], helpReports: [] });
initDataFile(LICENSE_FILE, { installId: null, lastVerifiedAt: null, lastCheckedAt: null, locked: false });

// ─── LICENSE / ACTIVATION MANAGER ────────────────────────────────────────
// Self-hosted installs "phone home" to a licensing server. When the license
// is missing, expired, revoked, or unpaid, the system locks down to
// read-only: every mutating API call is rejected with HTTP 402 and screens
// show a lock screen (see /js/license-client.js).
//
// Configuration (environment variables):
//   LICENSE_KEY          The restaurant's license key. If empty, licensing
//                        is disabled entirely (developer / managed-cloud mode).
//   LICENSE_SERVER_URL   Your licensing server, e.g. https://licenses.yourdomain.com
//   LICENSE_GRACE_DAYS   Days to keep running after the last successful
//                        verification when the licensing server is offline.
//                        Default: 3.
//   LICENSE_CHECK_HOUR   Hour of day (0-23) for the once-daily morning check.
//                        Default: 6 (6 AM).
//   LICENSE_CHECK_INTERVAL_HOURS  If set (1-24+), verify every N hours instead
//                        of once daily — use for snappier lockdown enforcement
//                        (e.g. 1 = checks hourly). Default: unset (daily).

const LICENSE_KEY = process.env.LICENSE_KEY || '';
const LICENSE_SERVER_URL = (process.env.LICENSE_SERVER_URL || '').replace(/\/+$/, '');
const LICENSE_GRACE_DAYS = Math.max(0, parseInt(process.env.LICENSE_GRACE_DAYS || '3', 10) || 0);
const LICENSE_CHECK_HOUR = Math.min(23, Math.max(0, parseInt(process.env.LICENSE_CHECK_HOUR || '6', 10) || 6));
const LICENSE_CHECK_INTERVAL_HOURS = Math.max(1, parseInt(process.env.LICENSE_CHECK_INTERVAL_HOURS || '0', 10) || 0);
const GRACE_MS = LICENSE_GRACE_DAYS * 24 * 60 * 60 * 1000;

const license = {
  enabled: !!LICENSE_KEY,
  locked: false,
  installId: null,
  lastVerifiedAt: null,
  lastCheckedAt: null,
  lastReason: null,
};

function readLicenseState() {
  try {
    const data = readJSON(LICENSE_FILE);
    license.installId = data.installId || null;
    license.lastVerifiedAt = data.lastVerifiedAt || null;
    license.lastCheckedAt = data.lastCheckedAt || null;
    license.locked = !!data.locked;
  } catch (err) {
    /* keep defaults */
  }
}

function saveLicenseState() {
  try {
    writeJSON(LICENSE_FILE, {
      installId: license.installId,
      lastVerifiedAt: license.lastVerifiedAt,
      lastCheckedAt: license.lastCheckedAt,
      locked: license.locked,
    });
  } catch (err) {
    console.error('  License: failed to persist state:', err.message);
  }
}

function ensureInstallId() {
  if (license.installId) return;
  const os = require('os');
  const raw = os.hostname() + '|' + os.platform() + '|' + crypto.randomBytes(8).toString('hex');
  license.installId = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
  saveLicenseState();
}

function setLocked(locked, reason) {
  const changed = license.locked !== locked;
  license.locked = locked;
  license.lastReason = reason || null;
  saveLicenseState();
  if (changed) {
    io.emit(locked ? 'license_locked' : 'license_unlocked', {
      reason: reason || null,
      at: new Date().toISOString(),
    });
    if (locked) {
      console.log('  🔒 LICENSE LOCKED — ' + (reason || 'inactive or unpaid license'));
    } else {
      console.log('  🔓 License unlocked');
    }
  }
}

function verifyLicense() {
  return new Promise((resolve) => {
    if (!license.enabled) return resolve({ ok: true, offline: false });
    if (!LICENSE_SERVER_URL) {
      return resolve({ ok: false, offline: true, reason: 'LICENSE_SERVER_URL is not configured' });
    }
    ensureInstallId();

    let target;
    try {
      target = new URL(LICENSE_SERVER_URL + '/api/license/verify');
    } catch (err) {
      return resolve({ ok: false, offline: true, reason: 'Invalid LICENSE_SERVER_URL' });
    }
    target.searchParams.set('key', LICENSE_KEY);
    target.searchParams.set('installId', license.installId);
    target.searchParams.set('hostname', require('os').hostname());

    // Support both https (production) and http (local/LAN testing)
    const client = target.protocol === 'https:' ? https : http;
    const req = client.get(target, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let data = null;
        try { data = JSON.parse(body); } catch (err) { /* ignore */ }
        // Only an explicit denial locks the system. 5xx / other unexpected
        // responses from OUR licensing server (e.g. a 502 during a deploy)
        // are treated as offline so the grace period applies instead of
        // locking every restaurant because of a vendor-side glitch.
        if (res.statusCode === 200 && data && data.valid) {
          resolve({ ok: true, offline: false, data });
        } else if (data && data.valid === false) {
          resolve({ ok: false, offline: false, reason: data.reason || 'License rejected by server' });
        } else if (res.statusCode === 400) {
          resolve({ ok: false, offline: false, reason: 'License server rejected the request (HTTP 400)' });
        } else if (res.statusCode >= 500) {
          resolve({ ok: false, offline: true, reason: 'License server error (HTTP ' + res.statusCode + ')' });
        } else {
          resolve({ ok: false, offline: true, reason: 'Unexpected response from license server' });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, offline: true, reason: 'License server timed out' });
    });
    req.on('error', (err) => {
      resolve({ ok: false, offline: true, reason: 'Cannot reach license server: ' + err.message });
    });
  });
}

async function runLicenseCheck() {
  if (!license.enabled) return;
  ensureInstallId();
  license.lastCheckedAt = new Date().toISOString();

  const result = await verifyLicense();

  if (result.ok) {
    license.lastVerifiedAt = new Date().toISOString();
    setLocked(false, null);
    const who = result.data && result.data.restaurant ? ' for ' + result.data.restaurant : '';
    console.log('  ✅ License verified' + who);
  } else if (result.offline) {
    // Phone-home unreachable — rely on the grace period since last success.
    const sinceVerified = license.lastVerifiedAt
      ? Date.now() - new Date(license.lastVerifiedAt).getTime()
      : Infinity;
    if (sinceVerified <= GRACE_MS) {
      setLocked(false, result.reason);
      const daysLeft = Math.max(0, Math.ceil((GRACE_MS - sinceVerified) / 86400000));
      console.log(`  ⚠️  License server unreachable — offline grace: ~${daysLeft} day(s) remaining`);
    } else {
      setLocked(true, 'License server unreachable beyond the ' + LICENSE_GRACE_DAYS + '-day grace period');
    }
  } else {
    // Server responded: license is invalid, expired, or revoked.
    setLocked(true, result.reason);
  }

  saveLicenseState();
}

function scheduleNextCheck() {
  // Interval mode: verify every N hours for snappier enforcement
  if (LICENSE_CHECK_INTERVAL_HOURS > 0) {
    const delay = LICENSE_CHECK_INTERVAL_HOURS * 60 * 60 * 1000;
    setTimeout(() => {
      runLicenseCheck();
      scheduleNextCheck();
    }, delay);
    console.log('  License: next verification in ' + LICENSE_CHECK_INTERVAL_HOURS + ' hour(s)');
    return;
  }

  // Default: once daily at the configured morning hour
  const now = new Date();
  const next = new Date(now);
  next.setHours(LICENSE_CHECK_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    runLicenseCheck();
    scheduleNextCheck();
  }, next.getTime() - now.getTime());
  console.log('  License: next verification ' + next.toLocaleString());
}

// ─── Middleware ──────────────────────────────────────────────────────────

app.use(express.json());

// CORS for cross-origin requests from tablets
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve shared static assets (style.css, motion.js, manifest, sw, icons)
app.use(express.static(PUBLIC_DIR));

// Health check (Render uses this)
app.get('/health', (req, res) => res.json({ ok: true, service: 'chauka-local' }));

// ─── LICENSE API ─────────────────────────────────────────────────────────
// (Placed after lead-gen routes so demo/signup stay open, and before the
// lockdown middleware so they work even while locked.)

// GET /api/license/status — current license state (lock screens poll this)
app.get('/api/license/status', (req, res) => {
  res.json({
    licensingEnabled: license.enabled,
    locked: license.locked,
    installId: license.installId,
    lastVerifiedAt: license.lastVerifiedAt,
    lastCheckedAt: license.lastCheckedAt,
    lastReason: license.lastReason,
    graceDays: LICENSE_GRACE_DAYS,
    checkHour: LICENSE_CHECK_HOUR,
  });
});

// POST /api/license/check — force an immediate re-verification
app.post('/api/license/check', (req, res) => {
  if (!license.enabled) {
    return res.json({ licensingEnabled: false, locked: false });
  }
  runLicenseCheck().then(() => {
    res.json({
      licensingEnabled: true,
      locked: license.locked,
      lastVerifiedAt: license.lastVerifiedAt,
      lastCheckedAt: license.lastCheckedAt,
      lastReason: license.lastReason,
    });
  });
});

// ─── LICENSE LOCKDOWN MIDDLEWARE ─────────────────────────────────────────
// When locked, reject all mutating /api requests (HTTP 402). Read-only GET
// requests stay available so staff can still view data.
app.use('/api', (req, res, next) => {
  if (!license.enabled || !license.locked) return next();
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') return next();
  return res.status(402).json({
    error: 'LICENSE_LOCKED',
    message: 'This system is locked because the license is inactive or unpaid. Please contact your service provider to renew.',
    locked: true,
  });
});

// ─── CATEGORY MANAGEMENT API ─────────────────────────────────────────────

// POST /api/menu/category — Add a new category
app.post('/api/menu/category', (req, res) => {
  try {
    const menu = readJSON(MENU_FILE);
    const { key, name } = req.body;

    if (!key || !name) {
      return res.status(400).json({ error: 'key and name are required' });
    }

    if (menu.categories[key]) {
      return res.status(400).json({ error: 'Category "' + key + '" already exists' });
    }

    menu.categories[key] = [];
    writeJSON(MENU_FILE, menu);
    io.emit('menu_updated', menu);

    console.log('  Category added: ' + name + ' (' + key + ')');

    res.status(201).json({ key, name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add category' });
  }
});

// ─── INGREDIENT REQUEST API ────────────────────────────────────────────

// POST /api/ingredient-request — Report missing ingredient
app.post('/api/ingredient-request', (req, res) => {
  try {
    const data = readJSON(KITCHEN_FILE);
    const { ingredient, quantity, requestedBy, tableNumber } = req.body;

    if (!ingredient || !quantity) {
      return res.status(400).json({ error: 'ingredient and quantity are required' });
    }

    const request = {
      id: data.nextIngredientId,
      ingredient,
      quantity,
      requestedBy: requestedBy || 'Staff',
      tableNumber: tableNumber || '',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    data.nextIngredientId++;
    data.ingredientRequests.push(request);
    writeJSON(KITCHEN_FILE, data);

    io.emit('new_ingredient_request', request);
    console.log(`  Ingredient request #${request.id}: ${ingredient} — ${quantity} (by ${request.requestedBy})`);

    res.status(201).json({ success: true, id: request.id });
  } catch (err) {
    console.error('Ingredient request error:', err);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// ─── INGREDIENT REQUESTS API (GET + PATCH) ─────────────────────────────

// GET /api/ingredient-requests — Fetch all open ingredient requests
app.get('/api/ingredient-requests', (req, res) => {
  try {
    const data = readJSON(KITCHEN_FILE);
    const openRequests = data.ingredientRequests.filter(r => r.status === 'open');
    res.json(openRequests);
  } catch (err) {
    console.error('Fetch ingredient requests error:', err);
    res.status(500).json({ error: 'Failed to fetch ingredient requests' });
  }
});

// PATCH /api/ingredient-requests/:id/resolve — Mark an ingredient request as resolved
app.patch('/api/ingredient-requests/:id/resolve', (req, res) => {
  try {
    const data = readJSON(KITCHEN_FILE);
    const requestId = parseInt(req.params.id);
    const request = data.ingredientRequests.find(r => r.id === requestId);

    if (!request) {
      return res.status(404).json({ error: 'Ingredient request not found' });
    }

    request.status = 'resolved';
    request.resolvedAt = new Date().toISOString();
    writeJSON(KITCHEN_FILE, data);

    io.emit('ingredient_request_resolved', request);
    console.log(`  Ingredient request #${requestId}: ${request.ingredient} — RESOLVED`);

    res.json({ success: true, request });
  } catch (err) {
    console.error('Resolve ingredient request error:', err);
    res.status(500).json({ error: 'Failed to resolve request' });
  }
});

// ─── RETURNED DISH API ─────────────────────────────────────────────────

// POST /api/returned-dish — Report a dish sent back (waiter only)
app.post('/api/returned-dish', (req, res) => {
  try {
    const data = readJSON(KITCHEN_FILE);
    const { dishName, quantity, reason, amount, tableNumber } = req.body;

    if (!dishName || !amount) {
      return res.status(400).json({ error: 'dishName and amount are required' });
    }

    const returned = {
      id: data.nextReturnId,
      dishName,
      quantity: quantity || 1,
      reason: reason || 'Incorrectly prepared',
      amount: parseFloat(amount),
      tableNumber: tableNumber || '',
      createdAt: new Date().toISOString(),
    };

    data.nextReturnId++;
    data.returnedDishes.push(returned);
    writeJSON(KITCHEN_FILE, data);

    io.emit('new_returned_dish', returned);
    console.log(`  Returned dish #${returned.id}: ${dishName} x${returned.quantity} — ₹${returned.amount}`);

    res.status(201).json({ success: true, id: returned.id });
  } catch (err) {
    console.error('Returned dish error:', err);
    res.status(500).json({ error: 'Failed to report returned dish' });
  }
});

// ─── HELP / COMPLAINT REPORT API ────────────────────────────────────────

// POST /api/help-report — Staff records a complaint/note (title + description)
app.post('/api/help-report', (req, res) => {
  try {
    const data = readJSON(KITCHEN_FILE);
    const { title, description, requestedBy, tableNumber } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const report = {
      id: data.nextHelpId,
      title: title.trim(),
      description: description.trim(),
      requestedBy: requestedBy || 'Staff',
      tableNumber: tableNumber || '',
      status: 'open',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };

    data.nextHelpId++;
    data.helpReports.push(report);
    writeJSON(KITCHEN_FILE, data);

    io.emit('new_help_report', report);
    console.log(`  Help report #${report.id}: ${report.title} (by ${report.requestedBy})`);

    res.status(201).json({ success: true, id: report.id });
  } catch (err) {
    console.error('Help report error:', err);
    res.status(500).json({ error: 'Failed to submit help report' });
  }
});

// GET /api/help-reports — Fetch all open help reports
app.get('/api/help-reports', (req, res) => {
  try {
    const data = readJSON(KITCHEN_FILE);
    const openReports = (data.helpReports || []).filter(r => r.status === 'open');
    res.json(openReports);
  } catch (err) {
    console.error('Fetch help reports error:', err);
    res.status(500).json({ error: 'Failed to fetch help reports' });
  }
});

// PATCH /api/help-reports/:id/resolve — Mark a help report as resolved
app.patch('/api/help-reports/:id/resolve', (req, res) => {
  try {
    const data = readJSON(KITCHEN_FILE);
    const reportId = parseInt(req.params.id, 10);
    const report = (data.helpReports || []).find(r => r.id === reportId);

    if (!report) {
      return res.status(404).json({ error: 'Help report not found' });
    }

    report.status = 'resolved';
    report.resolvedAt = new Date().toISOString();
    writeJSON(KITCHEN_FILE, data);

    io.emit('help_report_resolved', report);
    console.log(`  Help report #${reportId}: ${report.title} — RESOLVED`);

    res.json({ success: true, id: report.id });
  } catch (err) {
    console.error('Resolve help report error:', err);
    res.status(500).json({ error: 'Failed to resolve help report' });
  }
});

// ─── NETWORK INFO API ───────────────────────────────────────────────────

function getLANIP() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (loopback) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// GET /api/network — Get server's LAN IP
app.get('/api/network', (req, res) => {
  res.json({
    ip: getLANIP(),
    port: PORT,
    url: `http://${getLANIP()}:${PORT}`
  });
});

// ─── MENU API ───────────────────────────────────────────────────────────

// GET /api/menu — Fetch the full menu
app.get('/api/menu', (req, res) => {
  try {
    const menu = readJSON(MENU_FILE);
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read menu' });
  }
});

// POST /api/menu — Add a new menu item
app.post('/api/menu', (req, res) => {
  try {
    const menu = readJSON(MENU_FILE);
    const { category, name, price } = req.body;

    if (!category || !name || price === undefined) {
      return res.status(400).json({ error: 'category, name, and price are required' });
    }
    if (!menu.categories[category]) {
      return res.status(400).json({ error: `Invalid category "${category}". Valid: ${Object.keys(menu.categories).join(', ')}` });
    }

    const items = menu.categories[category];
    const newId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;

    const newItem = {
      id: newId,
      name,
      price: parseFloat(price),
      available: true,
    };

    items.push(newItem);
    writeJSON(MENU_FILE, menu);

    io.emit('menu_updated', menu);
    console.log('  Menu item added: ' + name + ' (₹' + price + ') in ' + category);

    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

// PUT /api/menu/:id — Update a menu item
app.put('/api/menu/:id', (req, res) => {
  try {
    const menu = readJSON(MENU_FILE);
    const itemId = parseInt(req.params.id);
    const { name, price, available } = req.body;

    for (const cat of Object.keys(menu.categories)) {
      const item = menu.categories[cat].find((i) => i.id === itemId);
      if (item) {
        if (name !== undefined) item.name = name;
        if (price !== undefined) item.price = parseFloat(price);
        if (available !== undefined) item.available = available;

        writeJSON(MENU_FILE, menu);
        io.emit('menu_updated', menu);

        return res.json(item);
      }
    }

    res.status(404).json({ error: 'Item not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// DELETE /api/menu/:id — Remove a menu item
app.delete('/api/menu/:id', (req, res) => {
  try {
    const menu = readJSON(MENU_FILE);
    const itemId = parseInt(req.params.id);

    for (const cat of Object.keys(menu.categories)) {
      const index = menu.categories[cat].findIndex((i) => i.id === itemId);
      if (index !== -1) {
        const removed = menu.categories[cat].splice(index, 1)[0];
        writeJSON(MENU_FILE, menu);
        io.emit('menu_updated', menu);

        return res.json(removed);
      }
    }

    res.status(404).json({ error: 'Item not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

// ─── ORDERS API ─────────────────────────────────────────────────────────

// GET /api/orders — Fetch all orders (optional ?table=XX filter)
app.get('/api/orders', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    let orders = data.orders;

    // Filter by table number if provided
    if (req.query.table) {
      const tableNum = String(req.query.table).padStart(2, '0');
      orders = orders.filter((o) => o.tableNumber === tableNum);
    }

    // Sort: newest first
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read orders' });
  }
});

// GET /api/orders/:id — Fetch a single order by ID (used by customer order tracking)
app.get('/api/orders/:id', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    const orderId = parseInt(req.params.id);
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read order' });
  }
});

// POST /api/orders/customer — Place a new order from customer self-ordering
app.post('/api/orders/customer', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    const { tableNumber, items } = req.body;

    if (!tableNumber || !items || items.length === 0) {
      return res.status(400).json({ error: 'tableNumber and items are required' });
    }

    const orderItems = addPendingStatusToItems(items);

    const order = {
      id: data.nextId,
      tableNumber: String(tableNumber).padStart(2, '0'),
      waiterId: null,
      waiterName: 'Customer',
      source: 'customer',
      items: orderItems,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.nextId++;
    data.orders.push(order);
    writeJSON(ORDERS_FILE, data);

    // Broadcast to Kitchen Display
    io.emit('kitchen_new_order', order);
    console.log('  Customer Order #' + order.id + ' placed for Table ' + order.tableNumber);

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to place customer order' });
  }
});

// POST /api/orders — Place a new order (from Waiter Pad)
app.post('/api/orders', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    const { tableNumber, waiterId, waiterName, items } = req.body;

    if (!tableNumber || !items || items.length === 0) {
      return res.status(400).json({ error: 'tableNumber and items are required' });
    }

    // Each item gets its own status
    const orderItems = addPendingStatusToItems(items);

    const order = {
      id: data.nextId,
      tableNumber: String(tableNumber).padStart(2, '0'),
      waiterId: waiterId || 1,
      waiterName: waiterName || 'Waiter',
      items: orderItems,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.nextId++;
    data.orders.push(order);
    writeJSON(ORDERS_FILE, data);

    // Broadcast new order to Kitchen Display
    io.emit('kitchen_new_order', order);
    console.log('  Order #' + order.id + ' placed for Table ' + order.tableNumber);

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// PUT /api/orders/:id — Update an order (edit items)
app.put('/api/orders/:id', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    const orderId = parseInt(req.params.id);
    const { items, status } = req.body;

    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (items) {
      // Preserve existing item statuses by matching on name
      order.items = items.map((newItem) => {
        const existing = order.items.find(
          (i) => i.name === newItem.name && i.modifiers === (newItem.modifiers || '')
        );
        return {
          ...newItem,
          status: existing && existing.status !== 'pending' ? existing.status : (newItem.status || 'pending'),
        };
      });
    }
    if (status) order.status = status;
    order.updatedAt = new Date().toISOString();

    // Derive order status from items if items changed
    if (items) {
      order.status = deriveOrderStatus(order.items);
    }

    writeJSON(ORDERS_FILE, data);
    io.emit('order_updated', order);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// PUT /api/orders/:id/status — Legacy: Mark entire order as delivered
app.put('/api/orders/:id/status', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    const validStatuses = ['pending', 'cooking', 'ready', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }

    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = status;
    order.updatedAt = new Date().toISOString();
    writeJSON(ORDERS_FILE, data);

    // Notify the specific waiter when order is ready
    if (status === 'ready') {
      io.emit('waiter_order_ready', order);
      console.log('  Order #' + orderId + ' marked READY — notified waiter');
    }

    io.emit('order_status_updated', order);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// PUT /api/orders/:id/items/:itemIndex/status — Update individual item status
app.put('/api/orders/:id/items/:itemIndex/status', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    const orderId = parseInt(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);
    const { status } = req.body;

    const validStatuses = ['pending', 'cooking', 'ready'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }

    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const item = order.items[itemIndex];
    if (!item) return res.status(404).json({ error: 'Item not found at this index' });

    item.status = status;
    order.updatedAt = new Date().toISOString();

    // Derive the overall order status from all items
    const newOrderStatus = deriveOrderStatus(order.items);
    order.status = newOrderStatus;

    writeJSON(ORDERS_FILE, data);

    // Emit events
    io.emit('item_status_updated', {
      orderId: order.id,
      tableNumber: order.tableNumber,
      itemIndex,
      item,
      orderStatus: newOrderStatus,
    });

    io.emit('order_updated', order);

    // Notify waiter if the order becomes fully ready
    if (newOrderStatus === 'ready' && status === 'ready') {
      io.emit('waiter_order_ready', order);
      console.log('  Order #' + orderId + ' all items READY — notified waiter');
    }

    res.json({ order, item, itemIndex });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item status' });
  }
});

// DELETE /api/orders/:id/items/:itemIndex — Cancel a single item (only if pending)
app.delete('/api/orders/:id/items/:itemIndex', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    const orderId = parseInt(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);

    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const item = order.items[itemIndex];
    if (!item) return res.status(404).json({ error: 'Item not found at this index' });

    // Can only cancel items that haven't started cooking
    if (item.status !== 'pending') {
      return res.status(400).json({
        error: `Cannot cancel item that is already ${item.status}. Only pending items can be cancelled.`,
      });
    }

    const removed = order.items.splice(itemIndex, 1)[0];
    order.updatedAt = new Date().toISOString();

    // If no items left, delete the entire order
    if (order.items.length === 0) {
      const orderIndex = data.orders.findIndex((o) => o.id === orderId);
      data.orders.splice(orderIndex, 1);
      writeJSON(ORDERS_FILE, data);
      io.emit('order_deleted', order);
      return res.json({ deleted: true, item: removed, message: 'Order deleted (no items remaining)' });
    }

    // Otherwise derive new status and update
    order.status = deriveOrderStatus(order.items);
    writeJSON(ORDERS_FILE, data);
    io.emit('order_updated', order);

    res.json({ deleted: false, item: removed, order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel item' });
  }
});

// DELETE /api/orders/:id — Cancel/delete an order
app.delete('/api/orders/:id', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    const orderId = parseInt(req.params.id);

    const index = data.orders.findIndex((o) => o.id === orderId);
    if (index === -1) return res.status(404).json({ error: 'Order not found' });

    const removed = data.orders.splice(index, 1)[0];
    writeJSON(ORDERS_FILE, data);

    io.emit('order_deleted', removed);

    res.json(removed);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// ─── ANALYTICS API ─────────────────────────────────────────────────────

// GET /api/analytics — Sales insights, top dishes, time-of-day breakdown
app.get('/api/analytics', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    const menu = readJSON(MENU_FILE);
    const orders = data.orders;

    // Build price lookup from menu
    const priceMap = {};
    for (const cat of Object.keys(menu.categories)) {
      for (const item of menu.categories[cat]) {
        priceMap[item.name.toLowerCase()] = item.price;
      }
    }

    // Filter delivered/completed orders for revenue calculations
    const completedOrders = orders.filter((o) => o.status === 'delivered');

    let totalRevenue = 0;
    let totalItemsSold = 0;
    const itemSales = {};
    const itemRevenue = {};
    const timeSlots = {
      morning: { label: '🌅 Morning (6-11)', orders: 0, revenue: 0, items: 0 },
      lunch: { label: '☀️ Lunch (11-14)', orders: 0, revenue: 0, items: 0 },
      afternoon: { label: '🌤️ Afternoon (14-17)', orders: 0, revenue: 0, items: 0 },
      dinner: { label: '🌙 Dinner (17-22)', orders: 0, revenue: 0, items: 0 },
      lateNight: { label: '🌃 Late Night (22-6)', orders: 0, revenue: 0, items: 0 },
    };

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Start of this week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let revenueToday = 0;
    let revenueThisWeek = 0;
    let revenueThisMonth = 0;
    let ordersToday = 0;
    let ordersThisWeek = 0;
    let ordersThisMonth = 0;

    // Sales breakdown buckets (local time): year / month / week (Sunday start) / day
    const yearMap = {};  // 'YYYY' -> { revenue, orders }
    const monthMap = {}; // 'YYYY-MM' -> { revenue, orders }
    const weekMap = {};  // Sunday date 'YYYY-MM-DD' -> { revenue, orders }
    const dayMap = {};   // 'YYYY-MM-DD' -> { revenue, orders }

    const fmtLocalDate = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    for (const order of completedOrders) {
      let orderItemCount = 0;
      let orderTotal = 0;

      for (const item of order.items) {
        const qty = item.quantity || 1;
        const price = priceMap[item.name.toLowerCase()] || 0;
        const lineTotal = price * qty;

        orderItemCount += qty;
        orderTotal += lineTotal;

        // Aggregate item sales count & revenue in one pass
        itemSales[item.name] = (itemSales[item.name] || 0) + qty;
        itemRevenue[item.name] = (itemRevenue[item.name] || 0) + lineTotal;
      }

      totalRevenue += orderTotal;
      totalItemsSold += orderItemCount;

      const createdAt = new Date(order.createdAt);
      const hour = createdAt.getHours();

      // Time of day slot
      let slot;
      if (hour >= 6 && hour < 11) slot = 'morning';
      else if (hour >= 11 && hour < 14) slot = 'lunch';
      else if (hour >= 14 && hour < 17) slot = 'afternoon';
      else if (hour >= 17 && hour < 22) slot = 'dinner';
      else slot = 'lateNight';

      timeSlots[slot].orders++;
      timeSlots[slot].revenue += orderTotal;
      timeSlots[slot].items += orderItemCount;

      // Period-based revenue
      const orderDate = createdAt.toISOString().slice(0, 10);
      if (orderDate === todayStr) {
        revenueToday += orderTotal;
        ordersToday++;
      }
      if (createdAt >= startOfWeek) {
        revenueThisWeek += orderTotal;
        ordersThisWeek++;
      }
      if (createdAt >= startOfMonth) {
        revenueThisMonth += orderTotal;
        ordersThisMonth++;
      }

      // Bucket into year / month / week / day (local time)
      const y = createdAt.getFullYear();
      const monthKey = `${y}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      const dayKey = fmtLocalDate(createdAt);
      const yearKey = String(y);

      const weekStart = new Date(createdAt);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = fmtLocalDate(weekStart);

      for (const map of [yearMap, monthMap, weekMap, dayMap]) {
        const key = map === yearMap ? yearKey : map === monthMap ? monthKey : map === weekMap ? weekKey : dayKey;
        if (!map[key]) map[key] = { revenue: 0, orders: 0 };
        map[key].revenue += orderTotal;
        map[key].orders++;
      }
    }

    // Top 10 dishes by quantity sold (revenue computed in same pass above)
    const topDishes = Object.entries(itemSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count], i) => ({
        rank: i + 1,
        name,
        count,
        revenue: Math.round((itemRevenue[name] || 0) * 100) / 100,
      }));

    // ─── Yearly / monthly / weekly / daily series (oldest → newest) ───
    const monthShort = (d) => d.toLocaleString('en-US', { month: 'short' });

    const byMonth = [];
    {
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const data = monthMap[key] || { revenue: 0, orders: 0 };
        byMonth.push({
          key,
          label: monthShort(d),
          fullLabel: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
          revenue: Math.round(data.revenue * 100) / 100,
          orders: data.orders,
        });
      }
    }

    const byWeek = [];
    {
      const thisSunday = new Date(now);
      thisSunday.setHours(0, 0, 0, 0);
      thisSunday.setDate(thisSunday.getDate() - thisSunday.getDay());
      for (let i = 11; i >= 0; i--) {
        const d = new Date(thisSunday);
        d.setDate(thisSunday.getDate() - i * 7);
        const key = fmtLocalDate(d);
        const data = weekMap[key] || { revenue: 0, orders: 0 };
        byWeek.push({
          key,
          label: `${d.getDate()} ${monthShort(d)}`,
          fullLabel: `Week of ${d.getDate()} ${monthShort(d)}`,
          revenue: Math.round(data.revenue * 100) / 100,
          orders: data.orders,
        });
      }
    }

    const byDay = [];
    {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(now.getDate() - i);
        const key = fmtLocalDate(d);
        const data = dayMap[key] || { revenue: 0, orders: 0 };
        byDay.push({
          key,
          label: `${d.getDate()} ${monthShort(d)}`,
          fullLabel: d.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
          revenue: Math.round(data.revenue * 100) / 100,
          orders: data.orders,
        });
      }
    }

    const thisYearData = yearMap[String(now.getFullYear())] || { revenue: 0, orders: 0 };
    const lastYearData = yearMap[String(now.getFullYear() - 1)] || { revenue: 0, orders: 0 };

    // ─── Wastage / Returns from sent-back dishes ───
    const kitchenData = readJSON(KITCHEN_FILE);
    const returnedDishes = kitchenData.returnedDishes || [];
    let totalWastage = 0;
    let totalReturns = 0;
    for (const rd of returnedDishes) {
      totalWastage += rd.amount * (rd.quantity || 1);
      totalReturns++;
    }

    res.json({
      summary: {
        totalOrders: completedOrders.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalItemsSold,
        averageOrderValue:
          completedOrders.length > 0
            ? Math.round((totalRevenue / completedOrders.length) * 100) / 100
            : 0,
        allOrders: orders.length,
        totalWastage: Math.round(totalWastage * 100) / 100,
        totalReturns,
      },
      periods: {
        today: { orders: ordersToday, revenue: Math.round(revenueToday * 100) / 100 },
        thisWeek: { orders: ordersThisWeek, revenue: Math.round(revenueThisWeek * 100) / 100 },
        thisMonth: { orders: ordersThisMonth, revenue: Math.round(revenueThisMonth * 100) / 100 },
      },
      sales: {
        thisYear: { revenue: Math.round(thisYearData.revenue * 100) / 100, orders: thisYearData.orders },
        lastYear: { revenue: Math.round(lastYearData.revenue * 100) / 100, orders: lastYearData.orders },
        byMonth,
        byWeek,
        byDay,
      },
      topDishes,
      timeSlots: Object.values(timeSlots).map((s) => ({
        ...s,
        revenue: Math.round(s.revenue * 100) / 100,
      })),
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

// ─── SOCKET.IO EVENT HANDLERS ──────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`  Client connected: ${socket.id}`);

  // Allow kitchen to update order status via WebSocket
  socket.on('update_order_status', (data) => {
    // Refuse writes while the license is locked (and flip every screen to the lock screen)
    if (license.enabled && license.locked) {
      io.emit('license_locked', { reason: license.lastReason });
      return;
    }
    const { orderId, status } = data;
    const fileData = readJSON(ORDERS_FILE);
    const order = fileData.orders.find((o) => o.id === orderId);

    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      writeJSON(ORDERS_FILE, fileData);

      if (status === 'ready') {
        io.emit('waiter_order_ready', order);
      }
      io.emit('order_status_updated', order);
    }
  });

  socket.on('disconnect', () => {
    console.log(`  Client disconnected: ${socket.id}`);
  });
});

// ─── Restaurant app pages ───────────────────────────────────────────────
// Mounted at /app/... — this is the restaurant system's own server.
app.use('/app', express.static(APP_DIR));

// Redirect legacy flat URLs (e.g. /app/waiter.html) to the new per-page
// folders (/app/waiter/) so already-printed QR codes keep working.
app.get('/app/:page.html', (req, res) => {
  const page = req.params.page;
  if (!['hub', 'waiter', 'kitchen', 'manager', 'customer'].includes(page)) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/app/' + page + '/' + qs);
});

// ─── 404 handler (after all API routes) ────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
});

// ─── START SERVER ───────────────────────────────────────────────────────

// Kick off license verification + schedule the next check
if (license.enabled) {
  readLicenseState();
  ensureInstallId();
  runLicenseCheck();
  scheduleNextCheck();
} else {
  console.log('  Licensing disabled (set LICENSE_KEY to enable).');
}

server.listen(PORT, '0.0.0.0', () => {
  const lanIP = getLANIP();
  console.log('');
  console.log('  ================================================');
  console.log('     CHAUKA RESTAURANT ENGINE');
  console.log('     Running on http://0.0.0.0:' + PORT);
  console.log('  ================================================');
  console.log('');
  console.log('  LAN Access:     http://' + lanIP + ':' + PORT);  console.log('  Hub:            http://localhost:' + PORT + '/app/hub/');
  console.log('  Waiter Pad:     http://localhost:' + PORT + '/app/waiter/?table=01');
  console.log('  Kitchen Display: http://localhost:' + PORT + '/app/kitchen/');
  console.log('  Manager Panel:   http://localhost:' + PORT + '/app/manager/');
  console.log('  Customer Menu:   http://localhost:' + PORT + '/app/customer/?table=01');
  console.log('');
});
