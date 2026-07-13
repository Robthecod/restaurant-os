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

    // Refresh urgency colors every 30 seconds (no full re-render)
    setInterval(refreshUrgencyColors, 30000);
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
      fetchOrders();
    });

    client.on('_disconnected', () => {
      state.socketConnected = false;
      dom.connDot.className = 'connection-dot disconnected';
    });

    // New order from waiter
    client.on('kitchen_new_order', (order) => {
      if (!state.orders.find((o) => o.id === order.id)) {
        state.orders.unshift(order);
        renderOrders();
        showNewOrderFlash(order);
        playNewOrderSound();
        updateStats();
      }
    });

    // Order updated (items changed via waiter edit)
    client.on('order_updated', (updatedOrder) => {
      const idx = state.orders.findIndex((o) => o.id === updatedOrder.id);
      if (idx !== -1) {
        state.orders[idx] = updatedOrder;
        renderOrders();
        updateStats();
      }
    });

    // Item status updated (kitchen starts cooking or marks ready)
    client.on('item_status_updated', (data) => {
      const order = state.orders.find((o) => o.id === data.orderId);
      if (order) {
        const item = order.items[data.itemIndex];
        if (item) {
          item.status = data.item.status;
        }
        if (data.orderStatus === 'ready') {
          // All items ready — remove from kitchen
          state.orders = state.orders.filter((o) => o.id !== data.orderId);
        }
        renderOrders();
        updateStats();
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
      let orders = await res.json();
      // Only show orders that have items not fully ready/delivered
      state.orders = orders.filter((o) => o.status !== 'ready' && o.status !== 'delivered');
      state.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderOrders();
      updateStats();
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }

  // ─── Render Orders ───────────────────────────────────────────────────
  function renderOrders() {
    // Filter by status
    let filtered = state.orders;
    if (state.filter !== 'all') {
      filtered = filtered.filter((o) => o.status === state.filter);
    }

    if (filtered.length === 0) {
      dom.kdsOrders.innerHTML = `
        <div class="kds-empty" id="kdsEmpty">
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

      order.items.forEach((item, idx) => {
        const itemStatus = item.status || 'pending';
        if (itemStatus === 'pending') {
          const cookBtn = card.querySelector(`.action-cook[data-index="${idx}"]`);
          if (cookBtn) cookBtn.addEventListener('click', () => updateItemStatus(order.id, idx, 'cooking'));
        }
        if (itemStatus === 'cooking') {
          const readyBtn = card.querySelector(`.action-ready[data-index="${idx}"]`);
          if (readyBtn) readyBtn.addEventListener('click', () => updateItemStatus(order.id, idx, 'ready'));
        }
      });

      const cancelBtn = card.querySelector('.action-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', () => deleteOrder(order.id));
    });
  }

  // ─── Get Urgency Level ───────────────────────────────────────────────
  function getUrgencyMinutes(createdAt) {
    const now = new Date();
    const then = new Date(createdAt);
    return Math.floor((now - then) / 60000);
  }

  function getUrgencyClass(minutes) {
    if (minutes >= 15) return 'urgency-red';
    if (minutes >= 10) return 'urgency-orange';
    if (minutes >= 5) return 'urgency-yellow';
    return 'urgency-white';
  }

  function getUrgencyLabel(minutes) {
    if (minutes >= 15) return '🔴 Urgent';
    if (minutes >= 10) return '🟠 Overdue';
    if (minutes >= 5) return '🟡 Pending';
    return '⚪ New';
  }

  // ─── Render Single Order Card ────────────────────────────────────────
  function renderOrderCard(order) {
    const timeAgo = getTimeAgo(order.createdAt);
    const waitMinutes = getUrgencyMinutes(order.createdAt);
    const urgencyClass = getUrgencyClass(waitMinutes);
    const urgencyLabel = getUrgencyLabel(waitMinutes);
    const hasPending = order.items.some((i) => (i.status || 'pending') === 'pending');
    const hasCooking = order.items.some((i) => i.status === 'cooking');

    const itemsHtml = order.items
      .map(
        (item, idx) => {
          const itemStatus = item.status || 'pending';
          return `
            <div class="order-item item-status-${itemStatus}" data-index="${idx}">
              <div class="order-item-main">
                <div class="order-item-top">
                  <span class="order-item-name">${item.name}</span>
                  <span class="order-item-qty">×${item.quantity}</span>
                  <span class="item-status-dot status-${itemStatus}" title="${itemStatus}"></span>
                </div>
                ${item.modifiers ? `<span class="order-item-mod">📝 ${item.modifiers}</span>` : ''}
                <span class="item-status-label">${getStatusLabel(itemStatus)}</span>
              </div>
              <div class="order-item-actions">
                ${itemStatus === 'pending'
                  ? `<button class="btn btn-sm btn-success action-cook" data-index="${idx}">👨‍🍳 Cook</button>`
                  : itemStatus === 'cooking'
                    ? `<button class="btn btn-sm btn-primary action-ready" data-index="${idx}">✅ Ready</button>`
                    : `<span class="item-done-badge">✅ Done</span>`
                }
              </div>
            </div>
          `;
        }
      )
      .join('');

    // Cancel button only if any item is still pending or cooking
    const showCancel = hasPending || hasCooking;

    return `
      <div class="order-card status-${order.status} ${urgencyClass}" data-id="${order.id}" data-created-at="${order.createdAt}">
        <div class="order-card-header">
          <div>
            <span class="order-table">Table ${order.tableNumber}</span>
            <span class="order-id"> · #${order.id}</span>
          </div>
          <div class="order-header-right">
            <span class="order-urgency-badge ${urgencyClass}">${urgencyLabel}</span>
            <span class="order-time">${timeAgo}</span>
          </div>
        </div>
        <div class="order-card-body">
          ${itemsHtml}
        </div>
        ${showCancel ? `
          <div class="order-card-actions">
            <button class="btn btn-danger action-cancel">✕ Cancel Order</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'pending': return '⏳ Pending';
      case 'cooking': return '👨‍🍳 Cooking';
      case 'ready': return '✅ Ready';
      default: return status;
    }
  }

  // ─── Update Single Item Status ───────────────────────────────────────
  async function updateItemStatus(orderId, itemIndex, status) {
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemIndex}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update item status');
      }
      // Update will come via socket
    } catch (err) {
      console.error('Update item status error:', err);
      showToast(`❌ ${err.message}`, 'error');
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
    let pendingCount = 0;
    let cookingCount = 0;

    state.orders.forEach((order) => {
      order.items.forEach((item) => {
        const s = item.status || 'pending';
        if (s === 'pending') pendingCount++;
        if (s === 'cooking') cookingCount++;
      });
    });

    dom.statPending.textContent = `${pendingCount} pending`;
    dom.statCooking.textContent = `${cookingCount} cooking`;
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

  // ─── Refresh Urgency Colors (run every 30s) ───────────────────────────
  function refreshUrgencyColors() {
    const cards = document.querySelectorAll('.order-card[data-created-at]');
    const now = Date.now();

    cards.forEach((card) => {
      const createdAt = card.getAttribute('data-created-at');
      if (!createdAt) return;

      const mins = Math.floor((now - new Date(createdAt).getTime()) / 60000);
      const cls = getUrgencyClass(mins);
      const label = getUrgencyLabel(mins);

      // Remove old urgency classes
      card.classList.remove('urgency-white', 'urgency-yellow', 'urgency-orange', 'urgency-red');
      card.classList.add(cls);

      // Update the badge
      const badge = card.querySelector('.order-urgency-badge');
      if (badge) {
        badge.className = `order-urgency-badge ${cls}`;
        badge.textContent = label;
      }

      // Update the time text
      const timeEl = card.querySelector('.order-time');
      if (timeEl) {
        timeEl.textContent = getTimeAgo(createdAt);
      }
    });
  }

  // ─── Event Listeners ─────────────────────────────────────────────────
  function setupEventListeners() {
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
