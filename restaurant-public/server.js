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
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

app.use(cors());
app.use(express.json());

// ─── File System Helpers ────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function initDataFile(file, defaultData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
  }
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

ensureDataDir();
initDataFile(LEADS_FILE, {
  nextDemoId: 1,
  nextSignupId: 1,
  demos: [],
  signups: [],
  newsletters: [],
  nextNewsletterId: 1,
});

// Redirect old /landing.html to /
app.get('/landing.html', (req, res) => {
  res.redirect(301, '/');
});

// Serve the marketing site (index.html, terms, privacy, assets)
app.use(express.static(path.join(__dirname)));

// ─── LEAD GENERATION API ─────────────────────────────────────────────

// POST /api/demo — Book a demo
app.post('/api/demo', (req, res) => {
  try {
    const data = readJSON(LEADS_FILE);
    const { name, email, restaurant, phone, date, message } = req.body;

    if (!name || !email || !restaurant || !date) {
      return res.status(400).json({ error: 'name, email, restaurant, and date are required' });
    }

    const demo = {
      id: data.nextDemoId,
      name,
      email,
      restaurant,
      phone: phone || '',
      preferredDate: date,
      message: message || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    data.nextDemoId++;
    data.demos.push(demo);
    writeJSON(LEADS_FILE, data);

    console.log(`  Demo booking #${demo.id}: ${name} — ${restaurant} (${email})`);
    if (demo.phone) console.log('     Phone: ' + demo.phone);
    if (demo.message) console.log('     Note: ' + demo.message);

    res.status(201).json({ success: true, id: demo.id });
  } catch (err) {
    console.error('Demo booking error:', err);
    res.status(500).json({ error: 'Failed to book demo' });
  }
});

// POST /api/signup — Start free trial signup
app.post('/api/signup', (req, res) => {
  try {
    const data = readJSON(LEADS_FILE);
    const { name, email, restaurant, phone, teamSize } = req.body;

    if (!name || !email || !restaurant) {
      return res.status(400).json({ error: 'name, email, and restaurant are required' });
    }

    const signup = {
      id: data.nextSignupId,
      name,
      email,
      restaurant,
      phone: phone || '',
      teamSize: teamSize || '',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    data.nextSignupId++;
    data.signups.push(signup);
    writeJSON(LEADS_FILE, data);

    console.log(`  Free trial signup #${signup.id}: ${name} — ${restaurant} (${email})`);
    if (signup.phone) console.log('     Phone: ' + signup.phone);
    if (signup.teamSize) console.log('     Team: ' + signup.teamSize);

    res.status(201).json({ success: true, id: signup.id });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// Health check (Render uses this)
app.get('/health', (req, res) => res.json({ ok: true, service: 'chauka-public' }));

// ─── 404 handler ────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
  }
});

server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ================================================');
  console.log('     CHAUKA — PUBLIC MARKETING SITE');
  console.log('     Running on http://0.0.0.0:' + PORT);
  console.log('  ================================================');
  console.log('');
  console.log('  Landing:  http://localhost:' + PORT + '/');
  console.log('');
});
