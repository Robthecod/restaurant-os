# 🥘 Roux — Real-Time Restaurant Engine

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

7. Once deployed, you'll get a URL like `https://roux.onrender.com`

8. **Open it** — you'll see the landing page. Then access:
   - 🏠 **Hub:** `https://your-app.onrender.com/hub.html`
   - 📋 **Waiter Pad:** `https://your-app.onrender.com/waiter.html?table=01`
   - 🍳 **Kitchen Display:** `https://your-app.onrender.com/kitchen.html`
   - 📊 **Manager Panel:** `https://your-app.onrender.com/manager.html`
   - 📱 **Customer Menu:** `https://your-app.onrender.com/customer.html?table=01`

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
| 🏠 Hub | http://localhost:3000/hub.html |
| 📋 Waiter Pad | http://localhost:3000/waiter.html?table=01 |
| 🍳 Kitchen Display | http://localhost:3000/kitchen.html |
| 📊 Manager Panel | http://localhost:3000/manager.html |
| 📱 Customer Menu | http://localhost:3000/customer.html?table=01 |

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
├── server.js              # Express + Socket.io server
├── package.json
├── render.yaml            # Render deployment config
├── data/
│   ├── menu.json          # Menu items & categories
│   ├── orders.json        # Order storage
│   └── leads.json         # Demo/signup leads
└── public/
    ├── index.html         # Marketing landing page
    ├── hub.html           # Multi-device control center
    ├── waiter.html        # Waiter Pad interface
    ├── kitchen.html       # Kitchen Display interface
    ├── manager.html       # Manager Panel interface
    ├── customer.html      # Customer self-ordering interface
    ├── 404.html
    ├── manifest.json
    ├── sw.js              # Service Worker (PWA)
    ├── css/
    │   ├── style.css      # Shared styles
    │   ├── waiter.css
    │   ├── kitchen.css
    │   ├── manager.css
    │   └── customer.css
    └── js/
        ├── socket-client.js
        ├── waiter.js
        ├── kitchen.js
        ├── manager.js
        └── customer.js
```

## 📄 License

MIT
