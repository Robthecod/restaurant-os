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

5. Render will auto-detect the two services from `render.yaml`:
   - **chauka-public** → the marketing site (`restaurant-public/`)
   - **chauka-local** → the restaurant system (`restaurant-local/`)

6. Click **"Create Web Service"** for each

7. Once deployed, you'll get URLs like `https://chauka.onrender.com` (public) and `https://chauka-local.onrender.com` (app)

8. **Open them** — the public URL shows the landing page; the app URL serves the restaurant system:

   🌐 **Public marketing site** — standalone project under `restaurant-public/`: landing page, demo/signup lead forms, terms & privacy. The restaurant app is never mounted here.

   🏠 **Restaurant app (self-hosted installs)** — standalone project under `restaurant-local/`, license-gated. Each screen has its own folder with its own styles & scripts:
   - 🏠 **Hub:** `http://your-lan-ip:3000/app/hub/`
   - 📋 **Waiter Pad:** `http://your-lan-ip:3000/app/waiter/?table=01`
   - 🍳 **Kitchen Display:** `http://your-lan-ip:3000/app/kitchen/`
   - 📊 **Manager Panel:** `http://your-lan-ip:3000/app/manager/`
   - 📱 **Customer Menu:** `http://your-lan-ip:3000/app/customer/?table=01`

> **Note:** Render's free tier spins down after 15 minutes of inactivity. Your first visit after idle time will take ~30 seconds to wake up. After that, it works normally until idle again.

## 🏠 Local Development

The repo is two separate projects (npm workspaces):

| Project | Folder | Runs | Port |
|---------|--------|------|------|
| 🌐 Marketing site | `restaurant-public/` | `npm run start:public` | 8080 |
| 🏠 Restaurant system | `restaurant-local/` | `npm run start:local` | 3000 |
| 🔑 License server | `restaurant-local/` | `npm run start:license` | 3100 |

```bash
# Install all dependencies (root workspace)
npm install

# Start the restaurant system (hub, waiter, kitchen, manager, customer)
npm start            # same as npm run start:local

# Optionally start the marketing site too
npm run start:public

# Open in browser
open http://localhost:3000/app/hub/
```

### Quick Access URLs (local)

| Interface | URL |
|-----------|-----|
| 🏠 Hub | http://localhost:3000/app/hub/ |
| 📋 Waiter Pad | http://localhost:3000/app/waiter/?table=01 |
| 🍳 Kitchen Display | http://localhost:3000/app/kitchen/ |
| 📊 Manager Panel | http://localhost:3000/app/manager/ |
| 📱 Customer Menu | http://localhost:3000/app/customer/?table=01 |

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
# From restaurant-local/
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
├── package.json            # Root workspace orchestrator (npm workspaces)
├── render.yaml            # Render config — one service per project
├── LICENSE
├── CHAUKA_PRODUCT_CONCEPT.md
├── restaurant-public/     # 🌐 PUBLIC MARKETING SITE — separate project
│   ├── server.js          # Express static + demo/signup lead APIs
│   ├── package.json
│   ├── data/
│   │   └── leads.json     # Demo & signup leads
│   ├── index.html         # Marketing landing page
│   ├── 404.html
│   ├── terms.html
│   ├── privacy.html
│   ├── robots.txt
│   ├── manifest.json
│   ├── sw.js              # Service Worker (PWA)
│   ├── icons/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── motion.js
└── restaurant-local/      # 🏠 RESTAURANT SYSTEM — separate project (license-gated)
    ├── server.js          # Express + Socket.io server
    ├── licensing-server.js# License management API (vendor-side, see 🔐 below)
    ├── package.json
    ├── .env               # LICENSE_KEY, LICENSE_SERVER_URL, LICENSE_ADMIN_TOKEN (git-ignored)
    ├── public/            # Shared assets served at root
    │   ├── css/style.css
    │   ├── js/motion.js
    │   ├── manifest.json
    │   ├── sw.js
    │   ├── icons/
    │   └── 404.html
    ├── app/               # Restaurant screens, mounted at /app/
    │   ├── hub/
    │   │   ├── index.html
    │   │   ├── hub.css
    │   │   └── hub.js
    │   ├── waiter/
    │   │   ├── index.html
    │   │   ├── waiter.css
    │   │   └── waiter.js
    │   ├── kitchen/
    │   │   ├── index.html
    │   │   ├── kitchen.css
    │   │   └── kitchen.js
    │   ├── manager/
    │   │   ├── index.html
    │   │   ├── manager.css
    │   │   └── manager.js
    │   ├── customer/
    │   │   ├── index.html
    │   │   ├── customer.css
    │   │   └── customer.js
    │   └── js/            # Shared scripts (socket client, license client)
    │       ├── socket-client.js
    │       └── license-client.js
    └── data/              # Restaurant data (menu, orders, kitchen, license state)
```

## 📄 License

**Proprietary — All Rights Reserved.**

Chauka is licensed software, not open source. You may only use it under a paid subscription agreement with the publisher. Copying, redistributing, modifying, or reselling the code without written permission is prohibited. See the [LICENSE](LICENSE) file for details.
