# 🍽️ Chauka — Restaurant Orchestration Platform
## Product Concept Document

---

## The Big Picture

A zero-hardware, real-time restaurant management system designed specifically for small Indian cafes, dhabas, and restaurants who can't afford expensive POS systems. The entire system runs on devices they already own — smartphones, tablets, old laptops.

---

## Core Architecture

Three screens, one server:

| Screen | Device | Who uses it |
|--------|--------|-------------|
| Waiter Pad | Waiter's own smartphone | Takes orders at the table |
| Kitchen Display | Any phone/tablet on a stand | Cook glances at it |
| Manager Panel | Owner's phone/laptop | Adds menu items, sees analytics |
| Customer QR Ordering | Guest's own phone | Self-ordering from table |

**Communication:** All connect via Socket.io over local WiFi. No internet required. No monthly subscription. No cloud dependency.

**Backend:** Node.js + Express + Socket.io  
**Frontend:** Vanilla JavaScript (no framework), CSS custom properties  
**Data:** Flat JSON files (zero database setup)  
**Real-time:** WebSockets via Socket.io with polling fallback  

---

## What's Built Today

### ✅ Waiter Pad
- Browse menu by category (Starters, Mains, Desserts, Drinks)
- Add items with modifiers ("No onions", "Extra spicy")
- Quantity controls in basket
- Send order → instantly appears in kitchen
- Order history with real-time status (pending → cooking → ready → delivered)
- Ready notification banner (green alert when food hits the counter)
- Edit sent orders (add/remove items while still pending)
- Sidebar live tracker for active order items
- Editable table number badge (switch between tables)

### ✅ Kitchen Display System (KDS)
- New orders appear instantly with sound + flash animation
- Per-item tracking: ⏳ Pending → 👨‍🍳 Cooking → ✅ Ready
- Cook taps "Cook" and "Ready" per item
- Urgency color-coding: white (new) → yellow (5min) → orange (10min) → red (15min+)
- Filter: All / Pending / Cooking
- Live clock + stats (items pending, items cooking)
- TV-optimized — scales up for big screens

### ✅ Manager Panel
- Add new menu items (name, price, category)
- Edit existing items (name, price, availability)
- Delete items
- Toggle item availability (sold out)
- Real-time sync — changes broadcast to all waiters instantly
- **Sales Analytics:**
  - Total revenue, orders completed, items sold, average order value
  - Today / This Week / This Month breakdown
  - Top 10 selling dishes with quantity bars
  - Sales by time of day (morning, lunch, afternoon, dinner, late night)

### ✅ Customer QR Ordering (Partially Built)
- Browse menu on phone
- Add items with modifiers
- Place order → kitchen receives it
- Track order status (pending → cooking → ready → delivered)
- No app download needed — works in browser

### ✅ Server
- Full REST API: menu CRUD, orders, analytics
- File-based JSON storage
- LAN auto-detection for easy multi-device setup
- CORS enabled for cross-origin tablet access

---

## The Problems We're Trying to Solve

### The Indian Small Cafe Reality

| # | Problem | Reality |
|---|---------|---------|
| 1 | **Cost of entry** | Can't afford ₹30,000–1,00,000 POS systems |
| 2 | **Paper chits** | Orders written on paper, stuck on kitchen wall |
| 3 | **Lost orders** | Chits fall in oil, get lost, or blow away |
| 4 | **Forgotten orders** | Cook has 15 orders in memory, forgets table 7 |
| 5 | **No time tracking** | Customer says "bahut time ho gaya!" — can't prove otherwise |
| 6 | **No business data** | Owner has no idea which items sell best, peak hours, AOV |
| 7 | **Customer disputes** | "maine yeh nahi manga" with no evidence |
| 8 | **Cold food** | Ready food sits on counter, nobody picks it up |
| 9 | **Yelling culture** | Waiter yells order, cook yells "ready!" — chaos at rush hour |
| 10 | **Menu management** | Changing prices means reprinting menus |

### How Chauka Solves Them

| # | Solution |
|---|----------|
| 1 | ₹0 hardware — uses phones they already own |
| 2 | Orders stored digitally. Can't fall in oil |
| 3 | Every order has a timestamp. Old orders turn red |
| 4 | Digital record of every order including modifiers |
| 5 | Manager knows exactly how long each table waited |
| 6 | Analytics: top dishes, peak hours, revenue trends, AOV |
| 7 | "Sir, aapne yeh manga tha" — proof in the system |
| 8 | Waiter gets instant banner when food is ready |
| 9 | Digital ordering. No shouting. No "kya likha hai?" |
| 10 | Change prices, add items, toggle availability in real-time |

---

## Problems We CAUSE (New Friction)

### The Core Tension

> *"The cook is the most important person in the kitchen, and also the hardest to digitize. Their hands are gloved, oily, burnt, wet. They will not touch a screen. Period."*

This is the central design challenge. Everything else is secondary.

| # | Problem | Severity | Potential Fix |
|---|---------|----------|---------------|
| 1 | **Cook must tap screen** | 🔴 HIGH | Cook's hands are oily/gloved. They won't tap. **#1 UX killer.** |
| 2 | Phone battery drain | 🟡 MEDIUM | Waiter's personal phone all day = dead battery by evening |
| 3 | Setup complexity | 🟡 MEDIUM | "Open this URL" is still tech for some cafe owners |
| 4 | Split attention | 🟡 MEDIUM | Waiter looking at phone instead of customer |
| 5 | Phone as liability | 🟡 MEDIUM | Waiter's phone gets dropped, stolen, or wet |
| 6 | No offline fallback | 🟡 MEDIUM | If WiFi goes down, whole system stops. Need paper backup |
| 7 | Learning curve | 🟢 LOW | Cook using chits for 20 years may resist change |
| 8 | Phone storage | 🟢 LOW | Where does waiter keep phone while carrying plates? |

### 🔴 #1 Priority: The Cook Won't Touch a Screen

Their hands are:
- 🧤 Gloved (hygiene)
- 🛢️ Oily/greasy
- 🧂 Floury
- 🔥 Burnt
- 💧 Wet

**Potential solutions:**

| Approach | Pro | Con |
|----------|-----|-----|
| **Auto-timer advancement** | Cook never taps | Can't cancel items once timer starts |
| **Waiter as operator** | Waiter marks items ready when picking up | More taps on waiter, less real-time accuracy |
| **Voice command** | Hands-free | Noisy kitchen, accent issues |
| **Physical button (foot/hand)** | Slap-able with oily hands | Adds hardware cost |

---

## Bugs We Found & Fixed

### 🐛 Duplicate Orders (FIXED)
**Symptoms:** Every order from waiter created 2 identical orders. Customer QR ordering appeared fine.

**Root Cause:** Service worker (`sw.js`) had `return fetch(event.request)` for API calls. Since `event.respondWith()` was never called, the browser ALSO sent its own POST — resulting in 2 identical POST requests to the server.

```
Page → fetch(POST /api/orders)
         ↓
   Service Worker intercepts
         ↓
   ┌── fetch(POST) from SW ──→ Server → Order #1
   │
   └── Browser's own POST ───→ Server → Order #2
```

**Why customer QR looked fine:** Same bug existed, but customer page doesn't refresh order list after placing, so duplicates were invisible.

**Fixes:**
1. `sw.js`: `return fetch(event.request)` → `return;` (don't intercept API calls)
2. `waiter.js`: Added `state.sending` guard flag to prevent duplicate submissions

### 🐛 Broken Dead Code (FIXED)
**Issue:** `getItemEmoji()` in `customer.js` had a malformed object literal with 30+ food emoji mappings that were never used.

**Fix:** Replaced with clean stub.

### 🐌 Mobile Lag on Landing Page (IDENTIFIED — NOT YET FIXED)
**Symptoms:** Scrolling on phones is janky.

**Causes:**
1. **4 morphing blob animations** running 24/7 — `border-radius` animation can't GPU-accelerate, triggers layout/paint every frame
2. **SVG `feTurbulence` filter** for grain texture — extremely expensive on mobile GPUs
3. **`backdrop-filter: blur(20px)`** on navbar — forces layer repaints on every scroll frame

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Real-time | Socket.io (WebSockets + polling fallback) |
| Frontend | Vanilla JavaScript (no framework) |
| Styling | CSS custom properties, light theme |
| Data | Flat JSON files (no database) |
| PWA | Service Worker for offline caching |
| Deployment | Single `node server.js` command on any LAN machine |

---

## What's Not Yet Built (Roadmap)

### Near-term (High Priority)
- [ ] **Auto-timer advancement** — Items auto-transition pending → cooking → ready based on configurable time limits. Cook never taps.
- [ ] **Waiter-as-operator mode** — Waiter marks items ready when picking up from counter.
- [ ] **Fix mobile performance** on landing page (pause blobs, remove grain on mobile)
- [ ] **Fix PWA** — Proper service worker that doesn't duplicate API calls (done) + home screen install

### Medium-term
- [ ] **Offline mode** — Queue orders when server/WiFi is down, sync when back online
- [ ] **Billing integration** — Auto-calculate bill from order data
- [ ] **Thermal printer support** — Receipt printing for kitchen/waiter
- [ ] **Complete QR self-ordering** — Polish the customer flow

### Future
- [ ] **Multi-language** — Hindi, Marathi, Tamil UI
- [ ] **WhatsApp integration** — Send order receipts via WhatsApp
- [ ] **Voice announcements** — New orders spoken aloud in kitchen
- [ ] **Table management** — Visual floor map with table statuses
- [ ] **Staff management** — Login system, shift tracking
- [ ] **GST billing** — Indian tax-compliant invoices

---

## Brand Identity

- **Name:** Chauka
- **Tagline:** Your Kitchen, Reinvented
- **Origin:** Made in India 🇮🇳
- **Design principle:** Zero hardware. Zero subscription. Zero cloud dependency.
- **Target market:** Small Indian cafes, dhabas, restaurants who can't afford POS systems
- **Competitive advantage:** Runs on devices they already own. Local WiFi only. No internet needed.

---

*Document generated from product concept discussion — July 2026*
