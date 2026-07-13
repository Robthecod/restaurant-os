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
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

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
      { id: 1, name: 'Crispy Corn', price: 395, available: true },
      { id: 2, name: 'Paneer Tikka', price: 495, available: true },
      { id: 3, name: 'Garlic Bread with Cheese', price: 395, available: true },
      { id: 4, name: 'Hara Bhara Kabab', price: 395, available: true },
      { id: 5, name: 'Masala Spring Rolls', price: 395, available: true },
      { id: 6, name: 'Mushroom Kurkure', price: 425, available: true },
      { id: 7, name: 'Nachos Supreme', price: 495, available: true },
      { id: 8, name: 'Sweet Potato Fries', price: 375, available: true },
      { id: 9, name: 'Chilli Paneer', price: 495, available: true },
      { id: 10, name: 'Veg Seekh Kabab', price: 425, available: true },
      { id: 11, name: 'Dahi Ke Kabab', price: 495, available: true },
      { id: 12, name: 'Spinach & Corn Soup', price: 325, available: true },
      { id: 13, name: 'Tomato Basil Soup', price: 295, available: true },
      { id: 14, name: 'Cheese Chilli Toast', price: 375, available: true },
    ],
    mains: [
      { id: 15, name: 'Veg Biryani', price: 595, available: true },
      { id: 16, name: 'Paneer Butter Masala', price: 595, available: true },
      { id: 17, name: 'Dal Makhani', price: 525, available: true },
      { id: 18, name: 'Shahi Paneer', price: 625, available: true },
      { id: 19, name: 'Kadai Vegetable', price: 545, available: true },
      { id: 20, name: 'Malai Kofta', price: 595, available: true },
      { id: 21, name: 'Dal Tadka', price: 475, available: true },
      { id: 22, name: 'Palak Paneer', price: 545, available: true },
      { id: 23, name: 'Paneer Tikka Masala', price: 625, available: true },
      { id: 24, name: 'Mix Veg Curry', price: 495, available: true },
      { id: 25, name: 'Aloo Gobi', price: 445, available: true },
      { id: 26, name: 'Bhindi Masala', price: 445, available: true },
      { id: 27, name: 'Jeera Rice', price: 295, available: true },
      { id: 28, name: 'Lemon Rice', price: 345, available: true },
      { id: 29, name: 'Veg Pulao', price: 495, available: true },
      { id: 30, name: 'Veg Pasta in White Sauce', price: 595, available: true },
      { id: 31, name: 'Veg Pasta in Red Sauce', price: 545, available: true },
      { id: 32, name: 'Veg Fried Rice', price: 495, available: true },
      { id: 33, name: 'Hakka Noodles', price: 495, available: true },
      { id: 34, name: 'Veg Manchurian Gravy', price: 495, available: true },
      { id: 35, name: 'Stuffed Paratha', price: 295, available: true },
      { id: 36, name: 'Butter Naan', price: 195, available: true },
      { id: 37, name: 'Special Veg Thali', price: 795, available: true },
      { id: 38, name: 'Veg Sizzler', price: 725, available: true },
    ],
    desserts: [
      { id: 39, name: 'Gulab Jamun (2 pcs)', price: 295, available: true },
      { id: 40, name: 'Gajar Ka Halwa', price: 325, available: true },
      { id: 41, name: 'Brownie with Ice Cream', price: 395, available: true },
      { id: 42, name: 'Mango Mousse', price: 375, available: true },
      { id: 43, name: 'Tiramisu', price: 425, available: true },
      { id: 44, name: 'Rasmalai', price: 345, available: true },
      { id: 45, name: 'Ice Cream (2 scoops)', price: 245, available: true },
      { id: 46, name: 'Sizzling Brownie', price: 445, available: true },
      { id: 47, name: 'Phirni', price: 295, available: true },
      { id: 48, name: 'Fresh Fruit Bowl', price: 345, available: true },
      { id: 49, name: 'Kulfi', price: 325, available: true },
      { id: 50, name: 'Cheesecake', price: 395, available: true },
    ],
    drinks: [
      { id: 51, name: 'Masala Chai', price: 195, available: true },
      { id: 52, name: 'Cold Coffee', price: 295, available: true },
      { id: 53, name: 'Mango Lassi', price: 345, available: true },
      { id: 54, name: 'Fresh Lime Soda', price: 195, available: true },
      { id: 55, name: 'Buttermilk (Chaas)', price: 175, available: true },
      { id: 56, name: 'Fruit Smoothie', price: 375, available: true },
      { id: 57, name: 'Coconut Water', price: 225, available: true },
      { id: 58, name: 'Soft Drinks', price: 99, available: true },
      { id: 59, name: 'Mint Lemonade', price: 225, available: true },
      { id: 60, name: 'Iced Tea', price: 245, available: true },
      { id: 61, name: 'Hot Chocolate', price: 325, available: true },
      { id: 62, name: 'Fresh Juice (Seasonal)', price: 295, available: true },
    ],
  },
});

initDataFile(ORDERS_FILE, { nextId: 1, orders: [] });
initDataFile(LEADS_FILE, { nextDemoId: 1, nextSignupId: 1, demos: [], signups: [] });

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

// Redirect old /landing.html to /
app.get('/landing.html', (req, res) => {
  res.redirect(301, '/');
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

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

    // Notify via socket.io
    io.emit('new_demo_booking', demo);

    console.log(`  📅 Demo booking #${demo.id}: ${name} — ${restaurant} (${email})`);
    if (demo.phone) console.log(`     Phone: ${demo.phone}`);
    if (demo.message) console.log(`     Note: ${demo.message}`);

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

    // Notify via socket.io
    io.emit('new_signup', signup);

    console.log(`  🚀 Free trial signup #${signup.id}: ${name} — ${restaurant} (${email})`);
    if (signup.phone) console.log(`     Phone: ${signup.phone}`);
    if (signup.teamSize) console.log(`     Team: ${signup.teamSize}`);

    res.status(201).json({ success: true, id: signup.id });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to sign up' });
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
    console.log(`  Menu item added: ${name} (₹${price}) in ${category}`);

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
    console.log(`  🛒 Customer Order #${order.id} placed for Table ${order.tableNumber}`);

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
      console.log(`  Order #${orderId} marked READY — notified waiter`);
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
      console.log(`  Order #${orderId} all items READY — notified waiter`);
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
      },
      periods: {
        today: { orders: ordersToday, revenue: Math.round(revenueToday * 100) / 100 },
        thisWeek: { orders: ordersThisWeek, revenue: Math.round(revenueThisWeek * 100) / 100 },
        thisMonth: { orders: ordersThisMonth, revenue: Math.round(revenueThisMonth * 100) / 100 },
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

// ─── 404 handler (after all API routes) ────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
});

// ─── START SERVER ───────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  const lanIP = getLANIP();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log(`  ║    🥘  ROUX RESTAURANT ENGINE                  ║`);
  console.log(`  ║    Running on http://0.0.0.0:${PORT}              ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  📡 LAN Access:     http://${lanIP}:${PORT}`);
  console.log(`  📋 Waiter Pad:     http://localhost:${PORT}/waiter.html?table=01`);
  console.log(`  🍳 Kitchen Display: http://localhost:${PORT}/kitchen.html`);
  console.log(`  📊 Manager Panel:   http://localhost:${PORT}/manager.html`);
  console.log('');
});
