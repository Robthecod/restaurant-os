# 🏠 Chauka — Restaurant System Setup Guide

How to install Chauka on a restaurant's computer and activate it with a license key.

---

## Part A — The vendor (you)

These steps happen once on **your** side, before the client gets anything.

### 1. Run the licensing server

The licensing server (`licensing-server.js`) is the "phone-home" target every restaurant install checks against.

- Deploy it to Render, a VPS, or any always-on host.
- Set the env var `LICENSE_ADMIN_TOKEN` to a strong secret — it protects the admin endpoints.
- Give it a public URL, e.g. `https://licenses.yourdomain.com`.

```bash
npm run start:license   # locally: http://localhost:3100
```

> ⚠️ Render's free tier uses an ephemeral disk — the key store (`licensing-data/licenses.json`) is wiped on redeploy. Attach a persistent disk, or move the store to a database, before onboarding real clients.

### 2. Create a key for the restaurant

Open your license manager (`https://licenses.yourdomain.com`, enter the admin token) and create a key with the restaurant's name and term. You get a key like:

```
CHK-XXXX-XXXX-XXXX-XXXX
```

The restaurant's install will show up on this page as `lastSeen` (install ID + hostname) whenever it checks in.

---

## Part B — The client (the restaurant)

### 3. Get the code onto their machine

The restaurant system is the `restaurant-os` repository. Either:

- Clone it on their computer (they need access to the private repo), or
- Copy/zip the project folder onto their machine.

### 4. Create the `.env` file

In the project folder, create a file named `.env` (next to `server.js`) with the restaurant's key:

```
LICENSE_KEY=CHK-XXXX-XXXX-XXXX-XXXX
LICENSE_SERVER_URL=https://licenses.yourdomain.com
```

| Variable | Purpose | Example |
|----------|---------|---------|
| `LICENSE_KEY` | The restaurant's license key | `CHK-XXXX-XXXX-XXXX-XXXX` |
| `LICENSE_SERVER_URL` | Your licensing server URL | `https://licenses.yourdomain.com` |
| `LICENSE_GRACE_DAYS` | Offline grace period (default `3`) | `3` |
| `LICENSE_CHECK_HOUR` | Daily check time, 0–23 (default `6`) | `6` |
| `LICENSE_CHECK_INTERVAL_HOURS` | Check every N hours instead of daily (snappier lockdown) | `1` |

The client does **not** need the admin token — that only lives on your licensing server.

### 5. Install and start

```bash
npm install
npm start
```

The server runs on port 3000.

### 6. Connect the screens

Open the **Hub** on the server machine:

```
http://localhost:3000/app/hub/
```

The hub shows the server's LAN IP and QR codes for every screen. Any device on the restaurant's WiFi can open:

| Screen | URL |
|--------|-----|
| 🏠 Hub | `http://<server-ip>:3000/app/hub/` |
| 📋 Waiter Pad | `http://<server-ip>:3000/app/waiter/?table=01` |
| 🍳 Kitchen Display | `http://<server-ip>:3000/app/kitchen/` |
| 📊 Manager Panel | `http://<server-ip>:3000/app/manager/` |
| 📱 Customer Menu | `http://<server-ip>:3000/app/customer/?table=01` |

For customer QR ordering, print the QR code from the hub (set the table number, then print). Customers scan it and order from their phone — no app install needed.

### 7. Keep it always on

For a permanent setup, run the server as a background service:

- **Linux server:** `pm2 start server.js` (or a systemd service)
- **Windows PC:** Task Scheduler at startup, or `pm2 start server.js`

---

## 🔒 If the license is not paid or expires

- The system **locks to read-only**: new orders, status changes, and menu edits are rejected (HTTP 402), and every screen shows a lock screen with the reason.
- The lock applies at the restaurant's **next check** — at startup, then daily at 6 AM (or hourly if `LICENSE_CHECK_INTERVAL_HOURS=1`).
- If your licensing server is **unreachable**, the restaurant keeps running for a **3-day grace period** (since the last successful check), then locks. This protects against vendor-side outages, not unpaid keys.
- To unlock: mark the key as **paid** in the license manager. The restaurant unlocks at its next check, or instantly via the "Check again" button on the lock screen.

## 🛠️ Troubleshooting

| Problem | Check |
|---------|-------|
| Server won't start / "Cannot reach license server" | Is `LICENSE_SERVER_URL` correct and reachable from the restaurant's network? |
| Screens locked after setup | Is `LICENSE_KEY` correct? Does the key show as paid/active in the license manager? |
| Lock screen says "License expired" | Extend the key in the license manager (**✅ Confirm paid**), then hit "Check again". |
| Port 3000 already in use | Set a different port: `PORT=3001 npm start` |
| Other devices can't open the pages | Same WiFi? Firewall allowing inbound port 3000? Use the LAN IP shown on the hub, not `localhost`. |
