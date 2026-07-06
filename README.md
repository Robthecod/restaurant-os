# 🍽️ Restaurant OS — Real-Time Orchestration Platform

A lightweight, event-driven restaurant management system that bridges front-of-house (waiters), back-of-house (kitchen), and administration (managers) through real-time WebSocket synchronization.

## Architecture

```
[ Waiter Pad ]          [ Manager Panel ]        [ Kitchen Display ]
 (waiter.html)            (manager.html)           (kitchen.html)
       │                        │                        │
       │ (REST / WebSockets)    │ (REST / WebSockets)    │ (WebSockets)
       ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NODE.JS + EXPRESS ENGINE                     │
│               (Real-time Routing & Event Server)                │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
         [ JSON FILE DB ]              [ SOCKET.IO EMITTER ]
          (menu / orders)               (System-wide Sync)
```

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
node server.js
```

Open in your browser:
- **Landing Page:** `http://localhost:3000/`
- **Waiter Pad:** `http://localhost:3000/waiter.html?table=01`
- **Kitchen Display:** `http://localhost:3000/kitchen.html`
- **Manager Panel:** `http://localhost:3000/manager.html`

## Project Structure

```
Rest2/
├── server.js              # Express + Socket.io engine
├── package.json           # Dependencies
├── README.md              # This file
├── data/
│   ├── menu.json          # Menu items (15 items across 3 categories)
│   └── orders.json        # Order persistence store
└── public/
    ├── index.html         # Landing page with navigation
    ├── waiter.html        # Waiter ordering interface
    ├── kitchen.html       # Kitchen Display System (KDS)
    ├── manager.html       # Administration panel
    ├── css/
    │   ├── style.css      # Shared design system
    │   ├── waiter.css     # Mobile-first waiter styles
    │   ├── kitchen.css    # Large display KDS styles
    │   └── manager.css    # Desktop admin styles
    └── js/
        ├── socket-client.js  # Singleton Socket.io client
        ├── waiter.js         # Waiter ordering logic
        ├── kitchen.js        # Kitchen order queue logic
        └── manager.js        # Menu administration logic
```

## Personas & Interfaces

### 1. Waiter Pad (`waiter.html`)
- **Mobile-first** design for use on the restaurant floor
- **URL-based table routing:** `?table=04` for automatic table assignment
- **Waiter identification:** `?waiter=John` (optional, defaults to "Waiter")
- **Category tabs:** Starters, Mains, Drinks — instant switching
- **Modifier modal:** Custom instructions per item with quick-select buttons
- **Quantity controls:** Adjust item counts before adding to basket
- **Live basket:** Preview items, edit quantities, remove items
- **One-click dispatch:** Sends order to kitchen via REST + WebSocket
- **Ready notifications:** Green banner when kitchen marks order as ready

### 2. Kitchen Display (`kitchen.html`)
- **Optimized for wall-mounted screens** — large, high-contrast cards
- **Real-time order queue:** New orders appear instantly via WebSocket
- **Status pipeline:** Pending → Cooking → Ready (one-click status changes)
- **Modifier highlighting:** Custom instructions shown in bright orange
- **Filter tabs:** View All, Pending, Cooking, or Ready orders
- **New-order flash:** Visual animation + audio beep on new orders
- **Counters:** Live stats for pending/cooking/ready orders

### 3. Manager Panel (`manager.html`)
- **Menu CRUD:** Add, edit, delete menu items with name, price, category
- **Toggle availability:** Enable/disable items without deleting
- **Live preview:** See the full menu organized by category
- **Real-time broadcast:** Changes sync instantly to all connected waiters
- **Quick stats:** Total items, available count, category count

## API Reference

### Menu Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/menu` | Fetch full menu with all categories |
| POST | `/api/menu` | Add new item (`category`, `name`, `price`) |
| PUT | `/api/menu/:id` | Update item (`name`, `price`, `available`) |
| DELETE | `/api/menu/:id` | Remove item |

### Order Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | Fetch all orders |
| POST | `/api/orders` | Place order (`tableNumber`, `items[]`) |
| PUT | `/api/orders/:id` | Update order items |
| PUT | `/api/orders/:id/status` | Update status (`pending| cooking| ready| delivered`) |
| DELETE | `/api/orders/:id` | Cancel/delete order |

### WebSocket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `kitchen_new_order` | Server → Kitchen | New order placed by waiter |
| `waiter_order_ready` | Server → Waiter | Order marked ready by kitchen |
| `order_status_updated` | Server → All | Any status change |
| `menu_updated` | Server → All | Menu modified by manager |
| `order_updated` | Server → All | Order items modified |
| `order_deleted` | Server → All | Order cancelled |
| `update_order_status` | Client → Server | Kitchen updates status (alt path) |

## Tech Stack

- **Backend:** Node.js + Express
- **Real-time:** Socket.io (WebSocket + long-polling fallback)
- **Storage:** Flat JSON files (`data/menu.json`, `data/orders.json`)
- **Frontend:** Vanilla JavaScript (no frameworks)
- **Styling:** Custom CSS with design system variables
- **Audio:** Web Audio API (kitchen new-order alert)

## Deployment

Designed for **local LAN deployment** within a restaurant:
- Runs on any machine with Node.js
- All UIs work in any modern browser (Chrome, Safari, Firefox)
- No database setup required — data persists to JSON files
- Bind to `0.0.0.0:3000` for LAN access from tablets and phones
- CORS enabled for cross-origin tablet access

## Design Principles

- **Zero-refresh:** All data flows through WebSockets — no page reloads
- **Fail-safe persistence:** Every transaction commits to disk immediately
- **Hardware agnostic:** Works on cheap Android tablets, old iPhones, smart TVs
- **Sub-100ms latency:** Event-driven architecture ensures instant propagation
- **Modifier-first:** Custom instructions bound to individual line items, not tables
