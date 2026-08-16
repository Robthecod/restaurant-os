# 🥘 Chauka — Real-Time Restaurant Engine

A lightweight, event-driven restaurant management system that bridges front-of-house (waiters), back-of-house (kitchen), administration (managers), and guests (QR self-ordering) through real-time WebSocket synchronization.

## ✨ Features

- **📋 Waiter Pad** — Mobile-first ordering with modifiers, basket, and live order tracking
- **🍳 Kitchen Display System** — TV-optimized KDS with per-item status & urgency colors
- **📊 Manager Panel** — Menu CRUD, live preview, and sales analytics dashboard
- **📱 Customer QR Ordering** — Guests scan a QR code and order from their phone
- **⚡ Real-Time Sync** — WebSocket-powered, sub-100ms propagation
- **🌐 Works on Any Device** — Phones, tablets, TVs, desktops — just a browser needed

## 🚀 Deploy to Render (Free)

1. **Push this repo to GitHub** (already done at `github.com/Robthecod/restaurant-os`)

2. **Go to [Render Dashboard](https://dashboard.render.com/)**

3. Click **"New +"** → **"Web Service"**

4. Connect your GitHub account and select this repo

5. Render will auto-detect the settings from `render.yaml`:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free

6. Click **"Create Web Service"**

7. Once deployed, you'll get a URL like `https://chauka.onrender.com`

8. **Open it** — you'll see the landing page. 

   🌐 **Public marketing site (you):** set the env var `PUBLIC_ONLY=true` on the Render deployment — only the landing page, demo/signup forms, terms & privacy are served. The restaurant app and its APIs are **never mounted**, so they stay off the public internet.

   🏠 **Restaurant app (local installs):** the app pages live under `/app/...` and are only served on local/LAN installs (the app folder isn't mounted in public-only mode):
   - 🏠 **Hub:** `http://your-lan-ip:3000/app/hub.html`
   - 📋 **Waiter Pad:** `http://your-lan-ip:3000/app/waiter.html?table=01`
   - 🍳 **Kitchen Display:** `http://your-lan-ip:3000/app/kitchen.html`
   - 📊 **Manager Panel:** `http://your-lan-ip:3000/app/manager.html`
   - 📱 **Customer Menu:** `http://your-lan-ip:3000/app/customer.html?table=01`

> **Note:** Render's free tier spins down after 15 minutes of inactivity. Your first visit after idle time will take ~30 seconds to wake up. After that, it works normally until idle again.

## 🏠 Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
open http://localhost:3000
```

### Quick Access URLs (local)

| Interface | URL |
|-----------|-----|
| 🏠 Hub | http://localhost:3000/app/hub.html |
| 📋 Waiter Pad | http://localhost:3000/app/waiter.html?table=01 |
| 🍳 Kitchen Display | http://localhost:3000/app/kitchen.html |
| 📊 Manager Panel | http://localhost:3000/app/manager.html |
| 📱 Customer Menu | http://localhost:3000/app/customer.html?table=01 |

## 🔐 Licensing & Protection (Self-Hosted Installations)

Chauka is licensed software (see [LICENSE](LICENSE)). Restaurant installs that you host *yourself* are tied to a **license key** that phones home to your licensing server:

- If the license is **missing, expired, revoked, or unpaid**, the system locks down to **read-only**: new orders, status changes, and menu edits are rejected (HTTP 402) and screens show a lock screen.
- The server verifies **once every morning** (default 6 AM, configurable).
- If your licensing server is **unreachable**, the system keeps running on a **3-day grace period** since the last successful verification, then locks.

### 1. Run your licensing server (the "phone home" target)

```bash
npm run start:license   # default port 3100
```

Open `http://localhost:3100/` and create a key for the restaurant there (you'll be prompted for the admin token). Keys are stored in `licensing-data/licenses.json` (git-ignored). Set `LICENSE_ADMIN_TOKEN` on the server — it protects the admin endpoints. Deploy this small server to Render or a VPS and give it its own domain, e.g. `https://licenses.yourdomain.com`.

**Billing workflow:** when a restaurant pays, open their row and click **✅ Confirm paid** (extends their expiry by the selected period). When they stop paying, click **⛔ Mark unpaid** — their install locks at its next daily check (or restart) and every screen shows the lock screen with the reason.

> ⚠️ **Render free tier** uses an ephemeral disk — the key store is wiped on every redeploy, silently invalidating all keys. Either add the `licensing-data/` file to Render's persistent disk, or store keys in a database/Redis when you outgrow this demo server.

### 2. Configure a self-hosted restaurant install

| Env var | Purpose | Example |
|---------|---------|---------|
| `LICENSE_KEY` | The restaurant's key. **Empty = licensing disabled** (dev / your own cloud deploy). | `CHK-XXXX-XXXX-XXXX-XXXX` |
| `LICENSE_SERVER_URL` | Your licensing server base URL. | `https://licenses.yourdomain.com` |
| `LICENSE_GRACE_DAYS` | Offline grace period (default `3`). | `3` |
| `LICENSE_CHECK_HOUR` | Daily verification hour, 0-23 (default `6`). | `6` |
| `LICENSE_CHECK_INTERVAL_HOURS` | Optional: verify every N hours instead of once daily — for snappier lockdown enforcement (e.g. `1` = checks hourly). | `1` |

```bash
LICENSE_KEY=CHK-XXXX-XXXX-XXXX-XXXX \
LICENSE_SERVER_URL=https://licenses.yourdomain.com \
node server.js
```

Your own managed cloud deployment doesn't need a key — just leave `LICENSE_KEY` unset.

> ⚠️ **Reality check:** this stops casual copying, but anyone running the full server on their own machine has the code and can defeat any client-side check. The real protections are the license (legal), your hosting, and the service agreement.

## 🏗️ Architecture

```
┌─────────────┐     WebSocket (Socket.io)     ┌──────────────┐
│  Waiter Pad  │◄────────────────────────────►│  Kitchen KDS │
│  (Phone)     │                               │  (TV/Monitor)│
└─────────────┘                               └──────────────┘
       │                                               │
       │           ┌──────────────────┐                │
       └──────────►│  Express Server  │◄───────────────┘
                   │  (REST + Socket) │
       ┌──────────►│  JSON File Store │◄───────────────┐
       │           └──────────────────┘                │
┌─────────────┐                               ┌──────────────┐
│  Manager    │                               │  Customer QR │
│  Panel      │◄─────────────────────────────►│  Self-Order   │
│  (Desktop)  │                               │  (Phone)      │
└─────────────┘                               └──────────────┘
```

## 📁 Project Structure

```
├── server.js              # Express + Socket.io server (public + local modes)
├── licensing-server.js    # License management API (vendor-side, see 🔐 below)
├── package.json
├── render.yaml            # Render deployment config
├── data/                  # Restaurant data (menu, orders, leads, license state)
├── public/                # 🌐 PUBLIC — served on every deployment
│   ├── index.html         # Marketing landing page
│   ├── 404.html           # (links to /app/hub.html on local installs)
│   ├── terms.html
│   ├── privacy.html
│   ├── robots.txt
│   ├── manifest.json
│   ├── sw.js              # Service Worker (PWA)
│   ├── icons/
│   ├── css/
│   │   └── style.css      # Shared styles (landing + app)
│   └── js/
│       └── motion.js      # Shared animations (landing + app)
└── app/                   # 🏠 LOCAL — restaurant system, mounted at /app/ only on local installs
    ├── hub.html           # Multi-device control center
    ├── waiter.html        # Waiter Pad interface
    ├── kitchen.html       # Kitchen Display interface
    ├── manager.html       # Manager Panel interface
    ├── customer.html      # Customer self-ordering interface
    ├── css/
    │   ├── waiter.css
    │   ├── kitchen.css
    │   ├── manager.css
    │   └── customer.css
    └── js/
        ├── socket-client.js
        ├── waiter.js
        ├── kitchen.js
        ├── manager.js
        ├── customer.js
        └── license-client.js
```

## 📄 License

**Proprietary — All Rights Reserved.**

Chauka is licensed software, not open source. You may only use it under a paid subscription agreement with the publisher. Copying, redistributing, modifying, or reselling the code without written permission is prohibited. See the [LICENSE](LICENSE) file for details.
