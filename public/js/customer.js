(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  const state = {
    tableNumber: '01',
    menu: null,
    cart: [],
    currentCategory: null,
    selectedItem: null,
    currentOrder: null, // the last placed order, for tracking
    socketConnected: false,
  };

  // ─── DOM References ────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Header
    tableBadge: $('#custTableBadge'),
    connDot: $('#custConnDot'),

    // Overview
    overview: $('#custOverview'),

    // Categories
    categories: $('#custCategories'),

    // Menu
    menuGrid: $('#custMenuGrid'),
    menuLoading: $('#custMenuLoading'),

    // Cart bar
    cartBar: $('#custCartBar'),
    cartCount: $('#custCartCount'),
    cartTotal: $('#custCartTotal'),
    placeOrder: $('#custPlaceOrder'),

    // Modal
    modalOverlay: $('#custModalOverlay'),
    modalIcon: $('#custModalIcon'),
    modalItemName: $('#custModalItemName'),
    modalItemPrice: $('#custModalItemPrice'),
    modalModifier: $('#custModalModifier'),
    modalQtyValue: $('#custModalQtyValue'),
    modalQtyDec: $('#custModalQtyDec'),
    modalQtyInc: $('#custModalQtyInc'),
    modalSkip: $('#custModalSkip'),
    modalAdd: $('#custModalAdd'),

    // Confirmation
    confirmation: $('#custConfirmation'),
    confirmOrderNum: $('#custConfirmOrderNum'),

    // Order status overlay
    orderStatus: $('#custOrderStatus'),
    statusIcon: $('#custStatusIcon'),
    statusTitle: $('#custStatusTitle'),
    statusRef: $('#custStatusRef'),
    statusTimeline: $('#custStatusTimeline'),
    statusNewOrder: $('#custStatusNewOrder'),

    // Toast
    toastContainer: $('#custToastContainer'),
  };

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    // Detect table from URL
    const params = new URLSearchParams(window.location.search);
    state.tableNumber = (params.get('table') || '01').padStart(2, '0');
    dom.tableBadge.textContent = `Table ${state.tableNumber}`;
    document.title = `Menu — Table ${state.tableNumber}`;

    // Setup Socket.io
    setupSocket();

    // Fetch menu
    fetchMenu();

    // Setup event listeners
    setupEventListeners();
  }

  // ─── Socket ──────────────────────────────────────────────────────────
  function setupSocket() {
    const client = RestaurantSocket.getInstance();
    client.connect();

    client.on('_connected', () => {
      state.socketConnected = true;
      dom.connDot.className = 'conn-indicator connected';
    });

    client.on('_disconnected', () => {
      state.socketConnected = false;
      dom.connDot.className = 'conn-indicator disconnected';
    });

    // Menu updates from manager
    client.on('menu_updated', (menu) => {
      state.menu = menu;
      if (state.currentCategory && !menu.categories[state.currentCategory]) {
        const cats = Object.keys(menu.categories);
        state.currentCategory = cats.length > 0 ? cats[0] : null;
      }
      renderMenu();
    });

    // Item status updates — refresh order status if tracking
    client.on('item_status_updated', (data) => {
      if (state.currentOrder && data.tableNumber === state.tableNumber) {
        refreshCurrentOrder();
      }
    });

    // Order status updated
    client.on('order_status_updated', (data) => {
      if (state.currentOrder && data.id === state.currentOrder.id) {
        state.currentOrder = data;
        updateStatusTimeline(data);
      }
    });
  }

  // ─── Fetch Menu ──────────────────────────────────────────────────────
  async function fetchMenu() {
    try {
      const res = await fetch('/api/menu');
      state.menu = await res.json();
      const cats = Object.keys(state.menu.categories);
      state.currentCategory = cats.length > 0 ? cats[0] : null;
      dom.menuLoading.style.display = 'none';
      renderCategories();
      renderMenu();
    } catch (err) {
      console.error('Failed to fetch menu:', err);
      dom.menuLoading.innerHTML = `
        <div class="customer-error-state">
          <span class="error-icon">📡</span>
          <div class="error-text">Couldn't load the menu.</div>
          <div class="error-sub">Make sure you're connected to the restaurant's network.</div>
          <button class="error-retry" onclick="window.location.reload()">Try Again</button>
        </div>
      `;
      setTimeout(fetchMenu, 3000);
    }
  }

  function renderCategories() {
    if (!state.menu) return;
    const cats = Object.keys(state.menu.categories);
    const catIcons = { starters: '🥟', mains: '🍛', desserts: '🍨', drinks: '🥤' };
    dom.categories.innerHTML = cats
      .map(
        (cat) => `
        <button class="customer-cat-tab ${cat === state.currentCategory ? 'active' : ''}"
                data-category="${cat}">
          <span class="cat-icon">${catIcons[cat] || '🍽️'}</span>
          <span class="cat-label">${capitalize(cat)}</span>
        </button>
      `
      )
      .join('');
  }

  // ─── Render Menu ─────────────────────────────────────────────────────
  function renderMenu() {
    if (!state.menu || !state.currentCategory) return;

    const items = state.menu.categories[state.currentCategory];
    if (!items) return;

    dom.menuGrid.innerHTML = items
      .map(
        (item, idx) => `
        <div class="customer-menu-item ${item.available ? '' : 'unavailable'}"
             data-id="${item.id}"
             data-category="${state.currentCategory}"
             style="animation-delay: ${idx * 35}ms">
          <span class="item-available"></span>
          <span class="item-emoji">${getItemEmoji(item.name)}</span>
          <span class="item-name">${item.name}</span>
          <span class="item-price">₹${item.price.toFixed(2)}</span>
          <span class="item-tap-hint">Tap to customize</span>
        </div>
      `
      )
      .join('');

    // Update category tabs
    $$('.customer-cat-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.category === state.currentCategory);
    });
  }

  // ─── Cart Operations ─────────────────────────────────────────────────
  function addToCart(item, quantity, modifiers) {
    const existing = state.cart.find(
      (c) => c.id === item.id && c.modifiers === modifiers
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      state.cart.push({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity,
        modifiers: modifiers || '',
      });
    }
    updateCartUI();
  }

  function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCartUI();
  }

  function updateCartUI() {
    const count = state.cart.reduce((sum, c) => sum + c.quantity, 0);
    const total = state.cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

    dom.cartCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    dom.cartTotal.textContent = `₹${total.toFixed(2)}`;
    dom.placeOrder.disabled = count === 0;

    // Bounce animation on count change
    dom.cartCount.classList.remove('cart-bounce');
    void dom.cartCount.offsetWidth; // force reflow
    dom.cartCount.classList.add('cart-bounce');
  }

  // ─── Place Order ────────────────────────────────────────────────────
  async function placeOrder() {
    if (state.cart.length === 0) return;

    const items = state.cart.map((c) => ({
      name: c.name,
      quantity: c.quantity,
      modifiers: c.modifiers,
    }));

    dom.placeOrder.disabled = true;
    dom.placeOrder.textContent = '⏳ Sending...';

    try {
      const res = await fetch('/api/orders/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: state.tableNumber,
          items,
        }),
      });

      if (!res.ok) throw new Error('Failed to place order');

      const order = await res.json();
      state.currentOrder = order;

      // Show confirmation
      dom.confirmOrderNum.textContent = `#${order.id}`;
      dom.cartBar.style.display = 'none';
      dom.customerHeader.style.display = 'none';
      dom.confirmation.style.display = 'block';

      // Clear cart
      state.cart = [];
      updateCartUI();

      showToast(`<span class="toast-icon">🎉</span> <span>Order #${order.id} placed! The kitchen has it.</span>`, 'success');

      // After 3 seconds, offer to track the order
      setTimeout(() => {
        dom.confirmation.querySelector('.track-btn').style.display = 'inline-block';
      }, 3000);
    } catch (err) {
      console.error('Place order error:', err);
      showToast('<span class="toast-icon">❌</span> <span>Could not place order. Try again!</span>', 'error');
    } finally {
      dom.placeOrder.disabled = false;
      dom.placeOrder.textContent = '🛒 Place Order';
    }
  }

  // ─── Order Status Tracking ───────────────────────────────────────────
  function showOrderStatus(order) {
    state.currentOrder = order;
    dom.confirmation.style.display = 'none';
    dom.overview.style.display = 'none';
    dom.categories.style.display = 'none';
    dom.menuGrid.parentElement.style.display = 'none';
    dom.cartBar.style.display = 'none';
    dom.customerHeader.style.display = 'flex';

    dom.statusRef.textContent = `Table ${order.tableNumber} · Order #${order.id}`;
    updateStatusTimeline(order);
    dom.orderStatus.classList.add('active');
  }

  function updateStatusTimeline(order) {
    const allStatuses = [
      { key: 'pending', icon: '⏳', label: 'Order Received', sub: 'Kitchen is looking at it' },
      { key: 'cooking', icon: '👨‍🍳', label: 'Being Prepared', sub: 'Your food is being cooked' },
      { key: 'ready', icon: '✅', label: 'Ready to Serve', sub: 'Coming your way shortly!' },
    ];

    const currentIdx = allStatuses.findIndex((s) => s.key === order.status) + 1;
    // Also check per-item status for more granular tracking
    const hasCookingItems = order.items.some((i) => i.status === 'cooking');
    const hasReadyItems = order.items.some((i) => i.status === 'ready');

    let activeIdx = 0;
    if (order.status === 'delivered') {
      activeIdx = 3;
    } else if (hasReadyItems) {
      activeIdx = 2;
    } else if (hasCookingItems || order.status === 'cooking') {
      activeIdx = 1;
    } else if (order.status === 'ready') {
      activeIdx = 2;
    }

    // Update status icon
    if (order.status === 'delivered') {
      dom.statusIcon.textContent = '🎉';
      dom.statusTitle.textContent = 'Enjoy your meal!';
    } else if (activeIdx === 2) {
      dom.statusIcon.textContent = '✅';
      dom.statusTitle.textContent = 'Almost there!';
    } else if (activeIdx === 1) {
      dom.statusIcon.textContent = '👨‍🍳';
      dom.statusTitle.textContent = 'Being prepared...';
    } else {
      dom.statusIcon.textContent = '⏳';
      dom.statusTitle.textContent = 'Order received!';
    }

    dom.statusTimeline.innerHTML = allStatuses
      .map((s, idx) => {
        let cls = '';
        if (idx < activeIdx) cls = 'done';
        else if (idx === activeIdx) cls = 'active';
        return `
          <div class="status-step ${cls}">
            <span class="step-icon">${idx < activeIdx ? '✅' : s.icon}</span>
            <div>
              <span class="step-text">${s.label}</span>
              <span class="step-sub">${idx < activeIdx ? 'Completed' : s.sub}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  async function refreshCurrentOrder() {
    if (!state.currentOrder) return;
    try {
      const res = await fetch(`/api/orders/${state.currentOrder.id}`);
      if (res.ok) {
        const order = await res.json();
        state.currentOrder = order;
        updateStatusTimeline(order);
      }
    } catch (err) {
      console.error('Failed to refresh order:', err);
    }
  }

  // ─── Modal ───────────────────────────────────────────────────────────
  function openItemModal(item, category) {
    state.selectedItem = { ...item, category };
    dom.modalIcon.textContent = getItemEmoji(item.name);
    dom.modalItemName.textContent = item.name;
    dom.modalItemPrice.textContent = `₹${item.price.toFixed(2)}`;
    dom.modalModifier.value = '';
    dom.modalQtyValue.textContent = '1';
    $$('.customer-qmod').forEach((btn) => btn.classList.remove('active'));
    dom.modalOverlay.classList.add('active');
  }

  function closeItemModal() {
    dom.modalOverlay.classList.remove('active');
    state.selectedItem = null;
  }

  function getItemEmoji(name) {
    const lower = name.toLowerCase();

    // Multi-word specific matches (checked first to avoid generic false matches)
    const specific = {
      'paneer butter masala': '🍛',
      'paneer tikka masala': '🍛',
      'paneer tikka': '🧀',
      'chilli paneer': '🧀',
      'palak paneer': '🧀',
      'shahi paneer': '🧀',
      'dahi ke kabab': '🥙',
      'hara bhara kabab': '🥙',
      'veg seekh kabab': '🥙',
      'veggie seekh kabab': '🥙',
      'masala spring rolls': '🥟',
      'spinach & corn soup': '🍜',
      'tomato basil soup': '🍜',
      'cheese chilli toast': '🧀',
      'crispy corn': '🌽',
      'sweet potato fries': '🍟',
      'garlic bread': '🍞',
      'nacho supreme': '🧀',
      'kadai vegetable': '🍲',
      'mix veg curry': '🍲',
      'malai kofta': '🧆',
      'gulab jamun': '🍡',
      'gajar ka halwa': '🍮',
      'brownie with ice cream': '🍫',
      'mango mousse': '🍮',
      'fresh fruit bowl': '🍎',
      'ice cream': '🍦',
      'sizzling brownie': '🍫',
      'masala chai': '🫖',
      'cold coffee': '☕',
      'mango lassi': '🥭',
      'fresh lime soda': '🍋',
      'fruit smoothie': '🥤',
      'coconut water': '🥥',
      'soft drinks': '🥤',
      'mint lemonade': '🍋',
      'iced tea': '🧋',
      'hot chocolate': '☕',
      'fresh juice': '🧃',
    };

    for (const [key, emoji] of Object.entries(specific)) {
      if (lower.includes(key)) return emoji;
    }

    // Generic keyword matches (fallback)
    const generic = {
      'noodles': '🍜',
      'pasta': '🍝',
      'biryani': '🍚',
      'pulao': '🍚',
      'fried rice': '🍚',
      'rice': '🍚',
      'dal': '🥣',
      'soup': '🍜',
      'spring roll': '🥟',
      'manchurian': '🥟',
      'mushroom': '🍄',
      'toast': '🍞',
      'paratha': '🫓',
      'naan': '🫓',
      'thali': '🍱',
      'sizzler': '🔥',
      'kabab': '🥙',
      'kebab': '🥙',
      'halwa': '🍮',
      'brownie': '🍫',
      'mousse': '🍮',
      'tiramisu': '☕',
      'rasmalai': '🥛',
      'cheesecake': '🍰',
      'kulfi': '🍦',
      'phirni': '🍮',
      'chai': '🫖',
      'coffee': '☕',
      'lassi': '🥤',
      'buttermilk': '🥛',
      'lemonade': '🍋',
      'juice': '🧃',
      'paneer': '🧀',
    };

    for (const [key, emoji] of Object.entries(generic)) {
      if (lower.includes(key)) return emoji;
    }

    return '🍽️';
  }

  // ─── Toast ───────────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `customer-toast ${type}`;
    toast.innerHTML = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ─── Event Listeners ─────────────────────────────────────────────────
  function setupEventListeners() {
    // Category tabs
    dom.categories.addEventListener('click', (e) => {
      const tab = e.target.closest('.customer-cat-tab');
      if (tab) {
        state.currentCategory = tab.dataset.category;
        renderMenu();
      }
    });

    // Menu item clicks
    dom.menuGrid.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.customer-menu-item');
      if (!itemEl || itemEl.classList.contains('unavailable')) return;

      const id = parseInt(itemEl.dataset.id);
      const category = itemEl.dataset.category;
      const item = state.menu.categories[category].find((i) => i.id === id);
      if (item) {
        openItemModal(item, category);
      }
    });

    // Quick modifiers
    dom.modalOverlay.addEventListener('click', (e) => {
      const btn = e.target.closest('.customer-qmod');
      if (btn) {
        btn.classList.toggle('active');
        const mods = Array.from(dom.modalOverlay.querySelectorAll('.customer-qmod.active'))
          .map((b) => b.dataset.mod)
          .join(', ');
        dom.modalModifier.value = mods;
      }
    });

    // Quantity controls
    dom.modalQtyDec.addEventListener('click', () => {
      let val = parseInt(dom.modalQtyValue.textContent);
      if (val > 1) dom.modalQtyValue.textContent = val - 1;
    });
    dom.modalQtyInc.addEventListener('click', () => {
      let val = parseInt(dom.modalQtyValue.textContent);
      if (val < 20) dom.modalQtyValue.textContent = val + 1;
    });

    // Modal Add
    dom.modalAdd.addEventListener('click', () => {
      if (!state.selectedItem) return;
      const quantity = parseInt(dom.modalQtyValue.textContent);
      const modifiers = dom.modalModifier.value.trim();
      addToCart(state.selectedItem, quantity, modifiers);
      closeItemModal();
      showToast(`<span class="toast-icon">✅</span> <span>Added ${quantity}x ${state.selectedItem.name}</span>`, 'success');
    });

    // Modal Skip
    dom.modalSkip.addEventListener('click', () => {
      if (!state.selectedItem) return;
      const quantity = parseInt(dom.modalQtyValue.textContent);
      addToCart(state.selectedItem, quantity, '');
      closeItemModal();
      showToast(`<span class="toast-icon">✅</span> <span>Added ${quantity}x ${state.selectedItem.name}</span>`, 'success');
    });

    // Close modal on overlay click
    dom.modalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.modalOverlay) closeItemModal();
    });

    // Place order
    dom.placeOrder.addEventListener('click', placeOrder);

    // Confirmation: Track order
    dom.confirmation.addEventListener('click', (e) => {
      const trackBtn = e.target.closest('.track-btn');
      if (trackBtn && state.currentOrder) {
        showOrderStatus(state.currentOrder);
      }
      const newOrderBtn = e.target.closest('.new-order-btn');
      if (newOrderBtn) {
        resetToMenu();
      }
    });

    // Order status: New order
    dom.statusNewOrder.addEventListener('click', resetToMenu);

    // Keyboard: Escape closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeItemModal();
      }
    });
  }

  // ─── Reset to Menu ──────────────────────────────────────────────────
  function resetToMenu() {
    state.currentOrder = null;
    dom.confirmation.style.display = 'none';
    dom.orderStatus.classList.remove('active');
    dom.overview.style.display = 'block';
    dom.categories.style.display = 'flex';
    dom.menuGrid.parentElement.style.display = 'block';
    dom.cartBar.style.display = 'flex';
    dom.customerHeader.style.display = 'flex';
    // Re-fetch menu
    fetchMenu();
  }

  // ─── Store header reference ─────────────────────────────────────────
  Object.defineProperty(dom, 'customerHeader', {
    get: () => document.querySelector('.customer-header'),
  });

  // ─── Start ───────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
