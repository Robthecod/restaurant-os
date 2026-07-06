const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

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

// ─── Initialize Data Store ──────────────────────────────────────────────

ensureDataDir();

initDataFile(MENU_FILE, {
  categories: {
    starters: [
      { id: 1, name: 'Spring Rolls', price: 5.99, available: true },
      { id: 2, name: 'Chicken Wings', price: 8.99, available: true },
      { id: 3, name: 'Garlic Bread', price: 4.99, available: true },
      { id: 4, name: 'Soup of the Day', price: 6.49, available: true },
    ],
    mains: [
      { id: 5, name: 'Chicken Biryani', price: 14.99, available: true },
      { id: 6, name: 'Grilled Salmon', price: 18.99, available: true },
      { id: 7, name: 'Beef Steak', price: 22.99, available: true },
      { id: 8, name: 'Vegetable Pasta', price: 12.99, available: true },
      { id: 9, name: 'Butter Chicken', price: 15.99, available: true },
      { id: 10, name: 'Fried Rice', price: 11.99, available: true },
    ],
    drinks: [
      { id: 11, name: 'Coca Cola', price: 2.99, available: true },
      { id: 12, name: 'Orange Juice', price: 3.49, available: true },
      { id: 13, name: 'Lemonade', price: 2.99, available: true },
      { id: 14, name: 'Mango Lassi', price: 3.99, available: true },
      { id: 15, name: 'Water', price: 1.49, available: true },
    ],
  },
});

initDataFile(ORDERS_FILE, { nextId: 1, orders: [] });

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

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

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
    console.log(`  Menu item added: ${name} ($${price}) in ${category}`);

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

// GET /api/orders — Fetch all orders
app.get('/api/orders', (req, res) => {
  try {
    const data = readJSON(ORDERS_FILE);
    res.json(data.orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read orders' });
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

    const order = {
      id: data.nextId,
      tableNumber: String(tableNumber).padStart(2, '0'),
      waiterId: waiterId || 1,
      waiterName: waiterName || 'Waiter',
      items,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.nextId++;
    data.orders.push(order);
    writeJSON(ORDERS_FILE, data);

    // Broadcast new order to Kitchen Display
    io.emit('kitchen_new_order', order);
    console.log(`  Order #${order.id} placed for Table ${order.tableNumber}`);

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

    if (items) order.items = items;
    if (status) order.status = status;
    order.updatedAt = new Date().toISOString();

    writeJSON(ORDERS_FILE, data);
    io.emit('order_updated', order);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// PUT /api/orders/:id/status — Update order status (Kitchen → Ready, etc.)
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
      console.log(`  Order #${orderId} marked READY — notified waiter`);
    }

    io.emit('order_status_updated', order);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
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

// ─── SOCKET.IO EVENT HANDLERS ──────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`  Client connected: ${socket.id}`);

  // Allow kitchen to update order status via WebSocket
  socket.on('update_order_status', (data) => {
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

// ─── START SERVER ───────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log(`  ║    🍽️  RESTAURANT ORCHESTRATION ENGINE       ║`);
  console.log(`  ║    Running on http://0.0.0.0:${PORT}              ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  📋 Waiter Pad:     http://localhost:${PORT}/waiter.html?table=01`);
  console.log(`  🍳 Kitchen Display: http://localhost:${PORT}/kitchen.html`);
  console.log(`  📊 Manager Panel:   http://localhost:${PORT}/manager.html`);
  console.log('');
});
