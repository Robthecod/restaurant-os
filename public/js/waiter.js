(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  const state = {
    tableNumber: '01',
    waiterId: 1,
    waiterName: 'Waiter',
    currentCategory: 'starters',
    menu: null,
    basket: [],
    selectedItem: null,  // item being modified
    socketConnected: false,
  };

  // ─── DOM References ────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    tableBadge: $('#tableBadge'),
    connDot: $('#connDot'),
    categoryTabs: $('#categoryTabs'),
    menuGrid: $('#menuGrid'),
    menuLoading: $('#menuLoading'),
    basketBar: $('#basketBar'),
    basketCount: $('#basketCount'),
    basketTotal: $('#basketTotal'),
    sendBtn: $('#sendBtn'),
    modifierModal: $('#modifierModal'),
    modalItemName: $('#modalItemName'),
    modalItemPrice: $('#modalItemPrice'),
    modifierInput: $('#modifierInput'),
    qtyValue: $('#qtyValue'),
    qtyDec: $('#qtyDec'),
    qtyInc: $('#qtyInc'),
    modalSkip: $('#modalSkip'),
    modalAdd: $('#modalAdd'),
    basketModal: $('#basketModal'),
    basketItems: $('#basketItems'),
    basketModalTotal: $('#basketModalTotal'),
    basketClose: $('#basketClose'),
    basketSend: $('#basketSend'),
    toastContainer: $('#toastContainer'),
  };

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    // Detect table and waiter from URL
    const params = new URLSearchParams(window.location.search);
    state.tableNumber = (params.get('table') || '01').padStart(2, '0');
    state.waiterName = params.get('waiter') || 'Waiter';
    dom.tableBadge.textContent = `Table ${state.tableNumber}`;
    document.title = `Waiter Pad — Table ${state.tableNumber}`;

    // Setup Socket.io
    setupSocket();

    // Fetch menu
    fetchMenu();

    // Event listeners
    setupEventListeners();
  }

  // ─── Socket ──────────────────────────────────────────────────────────
  function setupSocket() {
    const client = RestaurantSocket.getInstance();
    client.connect();

    client.on('_connected', () => {
      state.socketConnected = true;
      dom.connDot.className = 'connection-dot connected';
    });

    client.on('_disconnected', () => {
      state.socketConnected = false;
      dom.connDot.className = 'connection-dot disconnected';
    });

    // Listen for menu updates from manager
    client.on('menu_updated', (menu) => {
      state.menu = menu;
      renderMenu(state.currentCategory);
    });

    // Listen for ready orders
    client.on('waiter_order_ready', (order) => {
      if (order.tableNumber === state.tableNumber) {
        showReadyBanner(order);
      }
    });

    // Listen for order status updates
    client.on('order_status_updated', (order) => {
      if (order.tableNumber === state.tableNumber) {
        if (order.status === 'ready') {
          showReadyBanner(order);
        }
      }
    });
  }

  // ─── Fetch Menu ──────────────────────────────────────────────────────
  async function fetchMenu() {
    try {
      const res = await fetch('/api/menu');
      state.menu = await res.json();
      dom.menuLoading.style.display = 'none';
      renderMenu(state.currentCategory);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
      dom.menuLoading.textContent = '⚠️ Failed to load menu. Retrying...';
      setTimeout(fetchMenu, 3000);
    }
  }

  // ─── Render Menu ─────────────────────────────────────────────────────
  function renderMenu(category) {
    state.currentCategory = category;
    if (!state.menu || !state.menu.categories[category]) return;

    const items = state.menu.categories[category];
    dom.menuGrid.innerHTML = items
      .map(
        (item) => `
        <div class="menu-item ${item.available ? '' : 'unavailable'}" data-id="${item.id}" data-category="${category}">
          <span class="item-available"></span>
          <span class="item-name">${item.name}</span>
          <span class="item-price">₹${item.price.toFixed(2)}</span>
        </div>
      `
      )
      .join('');

    // Update tab active states
    $$('.tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.category === category);
    });
  }

  // ─── Basket Operations ───────────────────────────────────────────────
  function addToBasket(item, quantity, modifiers) {
    const existing = state.basket.find(
      (b) => b.id === item.id && b.modifiers === modifiers
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      state.basket.push({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity,
        modifiers: modifiers || '',
        category: state.currentCategory,
      });
    }
    updateBasketUI();
  }

  function removeFromBasket(index) {
    state.basket.splice(index, 1);
    updateBasketUI();
  }

  function updateBasketUI() {
    const count = state.basket.reduce((sum, b) => sum + b.quantity, 0);
    const total = state.basket.reduce((sum, b) => sum + b.price * b.quantity, 0);

    dom.basketCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    dom.basketTotal.textContent = `₹${total.toFixed(2)}`;
    dom.sendBtn.disabled = count === 0;
  }

  // ─── Send Order ──────────────────────────────────────────────────────
  async function sendOrder() {
    if (state.basket.length === 0) return;

    const items = state.basket.map((b) => ({
      name: b.name,
      quantity: b.quantity,
      modifiers: b.modifiers,
    }));

    dom.basketSend.disabled = true;
    dom.basketSend.textContent = '⏳ Sending...';

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: state.tableNumber,
          waiterId: state.waiterId,
          waiterName: state.waiterName,
          items,
        }),
      });

      if (!res.ok) throw new Error('Failed to send order');

      const order = await res.json();
      showToast(`✅ Order #${order.id} sent to kitchen!`, 'success');
      state.basket = [];
      updateBasketUI();
      dom.basketModal.classList.remove('active');
    } catch (err) {
      console.error('Send order error:', err);
      showToast('❌ Failed to send order. Try again.', 'error');
    } finally {
      dom.basketSend.disabled = false;
      dom.basketSend.textContent = 'Send to Kitchen →';
    }
  }

  // ─── Ready Banner ────────────────────────────────────────────────────
  function showReadyBanner(order) {
    // Remove existing banners
    document.querySelectorAll('.ready-banner').forEach((el) => el.remove());

    const banner = document.createElement('div');
    banner.className = 'ready-banner';
    banner.innerHTML = `
      <div class="ready-title">✅ Order #${order.id} is Ready!</div>
      <div class="ready-desc">Table ${order.tableNumber} — ${order.items
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(', ')}</div>
      <button class="dismiss-btn">Got it!</button>
    `;
    banner.querySelector('.dismiss-btn').addEventListener('click', () => {
      banner.style.animation = 'slideUp 0.3s ease reverse';
      setTimeout(() => banner.remove(), 300);
    });
    document.body.prepend(banner);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.animation = 'slideUp 0.3s ease reverse';
        setTimeout(() => banner.remove(), 300);
      }
    }, 10000);
  }

  // ─── Toast Notifications ─────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // ─── Modifier Modal Logic ────────────────────────────────────────────
  function openModifierModal(item, category) {
    state.selectedItem = { ...item, category };
    dom.modalItemName.textContent = item.name;
    dom.modalItemPrice.textContent = `₹${item.price.toFixed(2)}`;
    dom.modifierInput.value = '';
    dom.qtyValue.textContent = '1';
    $$('.quick-mod').forEach((btn) => btn.classList.remove('active'));
    dom.modifierModal.classList.add('active');
    dom.modifierInput.focus();
  }

  function closeModifierModal() {
    dom.modifierModal.classList.remove('active');
    state.selectedItem = null;
  }

  // ─── Event Listeners ─────────────────────────────────────────────────
  function setupEventListeners() {
    // Category tabs
    dom.categoryTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (tab) {
        renderMenu(tab.dataset.category);
      }
    });

    // Menu grid item clicks
    dom.menuGrid.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.menu-item');
      if (!itemEl || itemEl.classList.contains('unavailable')) return;

      const id = parseInt(itemEl.dataset.id);
      const category = itemEl.dataset.category;
      const item = state.menu.categories[category].find((i) => i.id === id);
      if (item) {
        openModifierModal(item, category);
      }
    });

    // Quick modifier buttons
    dom.modifierModal.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-mod');
      if (btn) {
        btn.classList.toggle('active');
        const mods = Array.from(
          dom.modifierModal.querySelectorAll('.quick-mod.active')
        )
          .map((b) => b.dataset.mod)
          .join(', ');
        dom.modifierInput.value = mods;
      }
    });

    // Quantity controls
    dom.qtyDec.addEventListener('click', () => {
      let val = parseInt(dom.qtyValue.textContent);
      if (val > 1) dom.qtyValue.textContent = val - 1;
    });
    dom.qtyInc.addEventListener('click', () => {
      let val = parseInt(dom.qtyValue.textContent);
      if (val < 20) dom.qtyValue.textContent = val + 1;
    });

    // Modal Add button
    dom.modalAdd.addEventListener('click', () => {
      if (!state.selectedItem) return;
      const quantity = parseInt(dom.qtyValue.textContent);
      const modifiers = dom.modifierInput.value.trim();
      addToBasket(state.selectedItem, quantity, modifiers);
      closeModifierModal();
      showToast(`Added ${quantity}x ${state.selectedItem.name}`, 'success');
    });

    // Modal Skip button (add without modifiers)
    dom.modalSkip.addEventListener('click', () => {
      if (!state.selectedItem) return;
      const quantity = parseInt(dom.qtyValue.textContent);
      addToBasket(state.selectedItem, quantity, '');
      closeModifierModal();
      showToast(`Added ${quantity}x ${state.selectedItem.name}`, 'success');
    });

    // Close modal on overlay click
    dom.modifierModal.addEventListener('click', (e) => {
      if (e.target === dom.modifierModal) closeModifierModal();
    });

    // Send button (basket bar)
    dom.sendBtn.addEventListener('click', openBasketModal);

    // Basket modal
    dom.basketClose.addEventListener('click', () => {
      dom.basketModal.classList.remove('active');
    });
    dom.basketSend.addEventListener('click', sendOrder);
    dom.basketModal.addEventListener('click', (e) => {
      if (e.target === dom.basketModal) dom.basketModal.classList.remove('active');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModifierModal();
        dom.basketModal.classList.remove('active');
      }
    });
  }

  // ─── Basket Modal ────────────────────────────────────────────────────
  function openBasketModal() {
    if (state.basket.length === 0) return;

    const total = state.basket.reduce((sum, b) => sum + b.price * b.quantity, 0);
    dom.basketModalTotal.textContent = `₹${total.toFixed(2)}`;

    dom.basketItems.innerHTML = state.basket
      .map(
        (b, i) => `
        <div class="basket-item" data-index="${i}">
          <div class="basket-item-info">
            <div class="basket-item-name">${b.name}</div>
            ${b.modifiers ? `<div class="basket-item-mod">📝 ${b.modifiers}</div>` : ''}
            <div class="basket-item-qty">Qty: ${b.quantity}</div>
          </div>
          <div class="basket-item-price">₹${(b.price * b.quantity).toFixed(2)}</div>
          <button class="basket-item-remove" data-index="${i}">✕</button>
        </div>
      `
      )
      .join('');

    // Remove buttons
    dom.basketItems.querySelectorAll('.basket-item-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        removeFromBasket(parseInt(btn.dataset.index));
        if (state.basket.length === 0) {
          dom.basketModal.classList.remove('active');
        } else {
          openBasketModal(); // Refresh
        }
      });
    });

    dom.basketModal.classList.add('active');
  }

  // ─── Start ───────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
