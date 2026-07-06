(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  const state = {
    orders: [],
    filter: 'all',
    socketConnected: false,
  };

  // ─── DOM References ────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    kdsTime: $('#kdsTime'),
    connDot: $('#connDot'),
    kdsOrders: $('#kdsOrders'),
    kdsEmpty: $('#kdsEmpty'),
    statPending: $('#statPending'),
    statCooking: $('#statCooking'),
    // statReady removed — ready orders auto-hide from kitchen
    kdsFilters: $('#kdsFilters'),
    toastContainer: $('#toastContainer'),
  };

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    // Clock
    updateClock();
    setInterval(updateClock, 1000);

    // Setup Socket.io
    setupSocket();

    // Fetch existing orders
    fetchOrders();

    // Event listeners
    setupEventListeners();
  }

  // ─── Clock ───────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    dom.kdsTime.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
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

    // New order from waiter
    client.on('kitchen_new_order', (order) => {
      // Add if not already exists
      if (!state.orders.find((o) => o.id === order.id)) {
        state.orders.unshift(order);
        renderOrders();
        showNewOrderFlash(order);
        playNewOrderSound();
        updateStats();
      }
    });

    // Status update — remove from kitchen when marked ready
    client.on('order_status_updated', (updatedOrder) => {
      if (updatedOrder.status === 'ready') {
        // Remove from kitchen display, waiter gets notified separately
        state.orders = state.orders.filter((o) => o.id !== updatedOrder.id);
        renderOrders();
        updateStats();
      } else {
        const idx = state.orders.findIndex((o) => o.id === updatedOrder.id);
        if (idx !== -1) {
          state.orders[idx] = updatedOrder;
          renderOrders();
          updateStats();
        }
      }
    });

    // Order updated (items changed)
    client.on('order_updated', (updatedOrder) => {
      const idx = state.orders.findIndex((o) => o.id === updatedOrder.id);
      if (idx !== -1) {
        state.orders[idx] = updatedOrder;
        renderOrders();
      }
    });

    // Order deleted
    client.on('order_deleted', (deletedOrder) => {
      state.orders = state.orders.filter((o) => o.id !== deletedOrder.id);
      renderOrders();
      updateStats();
    });
  }

  // ─── Fetch Orders ────────────────────────────────────────────────────
  async function fetchOrders() {
    try {
      const res = await fetch('/api/orders');
      state.orders = await res.json();
      // Sort: newest first
      state.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderOrders();
      updateStats();
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }

  // ─── Render Orders ───────────────────────────────────────────────────
  function renderOrders() {
    // Always exclude ready/delivered from kitchen display
    let filtered = state.orders.filter((o) => o.status !== 'ready' && o.status !== 'delivered');
    if (state.filter !== 'all') {
      filtered = filtered.filter((o) => o.status === state.filter);
    }

    if (filtered.length === 0) {
      dom.kdsOrders.innerHTML = `
        <div class="kds-empty">
          <div class="empty-icon">${state.filter === 'all' ? '🍽️' : '📭'}</div>
          <div class="empty-title">No ${state.filter === 'all' ? '' : state.filter} orders</div>
          <div class="empty-desc">${state.filter === 'all' ? 'Orders from waiters will appear here in real-time' : `No orders with status "${state.filter}"`}</div>
        </div>
      `;
      return;
    }

    dom.kdsOrders.innerHTML = filtered.map((order) => renderOrderCard(order)).join('');

    // Attach event listeners to action buttons
    filtered.forEach((order) => {
      const card = document.querySelector(`.order-card[data-id="${order.id}"]`);
      if (!card) return;

      if (order.status === 'pending') {
        const cookBtn = card.querySelector('.action-cook');
        if (cookBtn) cookBtn.addEventListener('click', () => updateStatus(order.id, 'cooking'));
      }

      if (order.status === 'cooking') {
        const readyBtn = card.querySelector('.action-ready');
        if (readyBtn) readyBtn.addEventListener('click', () => updateStatus(order.id, 'ready'));
      }

      const cancelBtn = card.querySelector('.action-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', () => deleteOrder(order.id));
    });
  }

  // ─── Render Single Order Card ────────────────────────────────────────
  function renderOrderCard(order) {
    const timeAgo = getTimeAgo(order.createdAt);
    const statusLabel =
      order.status.charAt(0).toUpperCase() + order.status.slice(1);

    const itemsHtml = order.items
      .map(
        (item) => `
        <div class="order-item">
          <div>
            <span class="order-item-name">${item.name}</span>
            <span class="order-item-qty">×${item.quantity}</span>
            ${item.modifiers ? `<span class="order-item-mod">📝 ${item.modifiers}</span>` : ''}
          </div>
        </div>
      `
      )
      .join('');

    let actionsHtml = '';
    if (order.status === 'pending') {
      actionsHtml = `
        <button class="btn btn-success action-cook">👨‍🍳 Start Cooking</button>
        <button class="btn btn-danger action-cancel">✕ Cancel</button>
      `;
    } else if (order.status === 'cooking') {
      actionsHtml = `
        <button class="btn btn-primary action-ready">✅ Mark Ready</button>
        <button class="btn btn-danger action-cancel">✕ Cancel</button>
      `;
    } else if (order.status === 'ready') {
      // Ready orders are auto-removed from kitchen, this shouldn't render
      return '';
    } else {
      actionsHtml = `
        <span style="flex:1;text-align:center;color:var(--text-muted);font-size:0.85rem;">
          Delivered
        </span>
      `;
    }

    return `
      <div class="order-card status-${order.status}" data-id="${order.id}">
        <div class="order-card-header">
          <div>
            <span class="order-table">Table ${order.tableNumber}</span>
            <span class="order-id"> · #${order.id}</span>
          </div>
          <span class="order-time">${timeAgo}</span>
        </div>
        <div class="order-card-body">
          ${itemsHtml}
        </div>
        <div class="order-card-actions">
          ${actionsHtml}
        </div>
      </div>
    `;
  }

  // ─── Update Status ───────────────────────────────────────────────────
  async function updateStatus(orderId, status) {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const updated = await res.json();
      // Will be updated via socket
    } catch (err) {
      console.error('Update status error:', err);
      showToast('❌ Failed to update order status', 'error');
    }
  }

  // ─── Delete Order ────────────────────────────────────────────────────
  async function deleteOrder(orderId) {
    if (!confirm(`Cancel order #${orderId}?`)) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete order');
      showToast(`🗑️ Order #${orderId} cancelled`, 'info');
    } catch (err) {
      console.error('Delete order error:', err);
      showToast('❌ Failed to cancel order', 'error');
    }
  }

  // ─── New Order Flash ─────────────────────────────────────────────────
  function showNewOrderFlash(order) {
    // Remove existing flash
    document.querySelectorAll('.new-order-flash').forEach((el) => el.remove());

    const flash = document.createElement('div');
    flash.className = 'new-order-flash';
    flash.textContent = `📥 New Order — Table ${order.tableNumber}`;
    document.body.appendChild(flash);

    setTimeout(() => flash.remove(), 2000);
  }

  // ─── Play Sound ──────────────────────────────────────────────────────
  function playNewOrderSound() {
    if (typeof newOrderSound === 'function') {
      try { newOrderSound(); } catch (e) {}
    }
  }

  // ─── Stats ───────────────────────────────────────────────────────────
  function updateStats() {
    const pending = state.orders.filter((o) => o.status === 'pending').length;
    const cooking = state.orders.filter((o) => o.status === 'cooking').length;

    dom.statPending.textContent = `${pending} pending`;
    dom.statCooking.textContent = `${cooking} cooking`;
  }

  // ─── Time Ago Helper ─────────────────────────────────────────────────
  function getTimeAgo(dateStr) {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return `${diffHrs}h ${remMins}m ago`;
  }

  // ─── Toast ───────────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  // ─── Event Listeners ─────────────────────────────────────────────────
  function setupEventListeners() {
    // Filter buttons
    dom.kdsFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (btn) {
        $$('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter = btn.dataset.filter;
        renderOrders();
        updateStats();
      }
    });
  }

  // ─── Start ───────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
