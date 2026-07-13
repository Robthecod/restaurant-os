(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  const state = {
    menu: null,
    editingItem: null, // { category, item }
    socketConnected: false,
  };

  // ─── DOM References ────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    connDot: $('#connDot'),
    syncStatus: $('#syncStatus'),
    syncLabel: $('#syncLabel'),
    menuForm: $('#menuForm'),
    itemCategory: $('#itemCategory'),
    itemName: $('#itemName'),
    itemPrice: $('#itemPrice'),
    menuPreview: $('#menuPreview'),
    qsTotal: $('#qsTotal'),
    qsActive: $('#qsActive'),
    editModal: $('#editModal'),
    editName: $('#editName'),
    editPrice: $('#editPrice'),
    editAvailable: $('#editAvailable'),
    editCancel: $('#editCancel'),
    editSave: $('#editSave'),
    toastContainer: $('#toastContainer'),
    mgrSubtitle: $('#mgrSubtitle'),
    menuView: $('#menuView'),
    analyticsView: $('#analyticsView'),
    analyticsLoading: $('#analyticsLoading'),
    analyticsContent: $('#analyticsContent'),
    analyticsSummary: $('#analyticsSummary'),
    analyticsPeriods: $('#analyticsPeriods'),
    topDishesList: $('#topDishesList'),
    timeSlotsList: $('#timeSlotsList'),
  };

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    setupSocket();
    fetchMenu();
    fetchAnalytics();
    setupEventListeners();
  }

  // ─── Socket ──────────────────────────────────────────────────────────
  function setupSocket() {
    const client = RestaurantSocket.getInstance();
    client.connect();

    client.on('_connected', () => {
      state.socketConnected = true;
      dom.connDot.className = 'connection-dot connected';
      dom.syncStatus.classList.remove('disconnected');
      dom.syncLabel.textContent = 'Connected';
    });

    client.on('_disconnected', () => {
      state.socketConnected = false;
      dom.connDot.className = 'connection-dot disconnected';
      dom.syncStatus.classList.add('disconnected');
      dom.syncLabel.textContent = 'Disconnected';
    });

    client.on('menu_updated', (menu) => {
      state.menu = menu;
      renderPreview();
      updateStats();
      showToast('📡 Menu synced to all devices', 'info');
    });
  }

  // ─── Fetch Menu ──────────────────────────────────────────────────────
  async function fetchMenu() {
    try {
      const res = await fetch('/api/menu');
      state.menu = await res.json();
      renderPreview();
      updateStats();
    } catch (err) {
      console.error('Failed to fetch menu:', err);
      dom.menuPreview.innerHTML = `
        <div class="preview-empty">
          <div class="empty-icon">⚠️</div>
          <div>Failed to load menu. <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button></div>
        </div>
      `;
    }
  }

  // ─── Add Item ────────────────────────────────────────────────────────
  async function addItem(category, name, price) {
    const submitBtn = dom.menuForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Adding...';

    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, name, price }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add item');
      }

      const item = await res.json();
      showToast(`✅ Added "${item.name}" to ${category}`, 'success');
      dom.itemName.value = '';
      dom.itemPrice.value = '';
      dom.itemName.focus();
    } catch (err) {
      console.error('Add item error:', err);
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '➕ Add to Menu';
    }
  }

  // ─── Update Item ─────────────────────────────────────────────────────
  async function updateItem(category, itemId, data) {
    dom.editSave.disabled = true;
    dom.editSave.textContent = '⏳ Saving...';

    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to update item');

      const item = await res.json();
      showToast(`✅ Updated "${item.name}"`, 'success');
      dom.editModal.classList.remove('active');
      state.editingItem = null;
    } catch (err) {
      console.error('Update item error:', err);
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      dom.editSave.disabled = false;
      dom.editSave.textContent = '💾 Save Changes';
    }
  }

  // ─── Delete Item ─────────────────────────────────────────────────────
  async function deleteItem(itemId) {
    if (!confirm('Delete this item? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/menu/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      showToast('🗑️ Item deleted', 'info');
    } catch (err) {
      console.error('Delete item error:', err);
      showToast(`❌ ${err.message}`, 'error');
    }
  }

  // ─── Render Menu Preview ─────────────────────────────────────────────
  const categoryEmojis = {
    starters: '🥟',
    mains: '🍛',
    drinks: '🥤',
  };

  const categoryLabels = {
    starters: 'Starters',
    mains: 'Mains',
    drinks: 'Drinks',
  };

  function renderPreview() {
    if (!state.menu || !state.menu.categories) {
      dom.menuPreview.innerHTML = '<div class="preview-loading">No menu data</div>';
      return;
    }

    const categories = Object.keys(state.menu.categories);
    const allItems = categories.flatMap((cat) => state.menu.categories[cat]);
    const totalItems = allItems.length;
    const activeItems = allItems.filter((i) => i.available).length;

    let html = '';
    for (const cat of categories) {
      const items = state.menu.categories[cat];
      const emoji = categoryEmojis[cat] || '📋';
      const label = categoryLabels[cat] || cat;

      html += `
        <div class="preview-category">
          <div class="preview-category-header">
            <h3>${emoji} ${label}</h3>
            <span class="preview-category-count">${items.length} item${items.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="preview-items">
            ${items.length === 0
              ? '<div class="preview-item"><span class="text-muted" style="padding:8px 16px;">No items — add some!</span></div>'
              : items
                  .map(
                    (item) => `
                <div class="preview-item" data-category="${cat}" data-id="${item.id}">
                  <div class="preview-item-info">
                    <span class="preview-item-name">${item.name}</span>
                    <span class="preview-item-status ${item.available ? 'available' : 'unavailable'}">
                      ${item.available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                  <div style="display:flex;align-items:center;">
                    <span class="preview-item-price">₹${item.price.toFixed(2)}</span>
                    <span class="preview-item-actions">
                      <button class="edit-btn" data-category="${cat}" data-id="${item.id}" title="Edit">✏️</button>
                      <button class="delete-btn" data-category="${cat}" data-id="${item.id}" title="Delete">🗑️</button>
                    </span>
                  </div>
                </div>
              `
                  )
                  .join('')}
          </div>
        </div>
      `;
    }

    dom.menuPreview.innerHTML = html;

    // Attach event listeners for edit/delete buttons
    dom.menuPreview.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.category;
        const id = parseInt(btn.dataset.id);
        openEditModal(cat, id);
      });
    });

    dom.menuPreview.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        deleteItem(id);
      });
    });
  }

  // ─── Update Stats ────────────────────────────────────────────────────
  function updateStats() {
    if (!state.menu) return;
    const categories = Object.keys(state.menu.categories);
    const allItems = categories.flatMap((cat) => state.menu.categories[cat]);
    dom.qsTotal.textContent = allItems.length;
    dom.qsActive.textContent = allItems.filter((i) => i.available).length;
  }

  // ─── Edit Modal ──────────────────────────────────────────────────────
  function openEditModal(category, itemId) {
    const item = state.menu.categories[category].find((i) => i.id === itemId);
    if (!item) return;

    state.editingItem = { category, item };
    dom.editName.value = item.name;
    dom.editPrice.value = item.price;
    dom.editAvailable.checked = item.available;
    dom.editModal.classList.add('active');
  }

  function closeEditModal() {
    dom.editModal.classList.remove('active');
    state.editingItem = null;
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

  // ─── Tab Switching ───────────────────────────────────────────────────
  function switchTab(tab) {
    document.querySelectorAll('.mgr-tab').forEach((t) => t.classList.remove('active'));
    document.querySelector(`.mgr-tab[data-tab="${tab}"]`).classList.add('active');

    if (tab === 'menu') {
      dom.menuView.style.display = '';
      dom.analyticsView.style.display = 'none';
      dom.mgrSubtitle.textContent = 'Menu Administration';
    } else {
      dom.menuView.style.display = 'none';
      dom.analyticsView.style.display = '';
      dom.mgrSubtitle.textContent = 'Sales Analytics';
      // Refresh analytics
      fetchAnalytics();
    }
  }

  // ─── Fetch Analytics ─────────────────────────────────────────────────
  async function fetchAnalytics() {
    dom.analyticsLoading.style.display = '';
    dom.analyticsContent.style.display = 'none';

    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      renderAnalytics(data);
      dom.analyticsLoading.style.display = 'none';
      dom.analyticsContent.style.display = '';
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      dom.analyticsLoading.innerHTML = `
        <div class="preview-empty">
          <div class="empty-icon">⚠️</div>
          <div>Failed to load analytics. <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button></div>
        </div>
      `;
    }
  }

  // ─── Render Analytics ────────────────────────────────────────────────
  function renderAnalytics(data) {
    renderSummary(data.summary);
    renderPeriods(data.periods);
    renderTopDishes(data.topDishes);
    renderTimeSlots(data.timeSlots);
  }

  function renderSummary(summary) {
    dom.analyticsSummary.innerHTML = `
      <div class="analytics-stat-card highlight">
        <span class="analytics-stat-icon">💰</span>
        <span class="analytics-stat-value">₹${summary.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        <span class="analytics-stat-label">Total Revenue</span>
      </div>
      <div class="analytics-stat-card">
        <span class="analytics-stat-icon">📦</span>
        <span class="analytics-stat-value">${summary.totalOrders}</span>
        <span class="analytics-stat-label">Orders Completed</span>
      </div>
      <div class="analytics-stat-card">
        <span class="analytics-stat-icon">🍽️</span>
        <span class="analytics-stat-value">${summary.totalItemsSold}</span>
        <span class="analytics-stat-label">Items Sold</span>
      </div>
      <div class="analytics-stat-card">
        <span class="analytics-stat-icon">📊</span>
        <span class="analytics-stat-value">₹${summary.averageOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        <span class="analytics-stat-label">Avg Order Value</span>
      </div>
    `;
  }

  function renderPeriods(periods) {
    dom.analyticsPeriods.innerHTML = `
      <div class="period-card">
        <span class="period-label">Today</span>
        <span class="period-revenue">₹${periods.today.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        <span class="period-orders">${periods.today.orders} order${periods.today.orders !== 1 ? 's' : ''}</span>
      </div>
      <div class="period-card">
        <span class="period-label">This Week</span>
        <span class="period-revenue">₹${periods.thisWeek.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        <span class="period-orders">${periods.thisWeek.orders} order${periods.thisWeek.orders !== 1 ? 's' : ''}</span>
      </div>
      <div class="period-card">
        <span class="period-label">This Month</span>
        <span class="period-revenue">₹${periods.thisMonth.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        <span class="period-orders">${periods.thisMonth.orders} order${periods.thisMonth.orders !== 1 ? 's' : ''}</span>
      </div>
    `;
  }

  function renderTopDishes(dishes) {
    if (!dishes || dishes.length === 0) {
      dom.topDishesList.innerHTML = '<div class="analytics-empty">No completed orders yet</div>';
      return;
    }

    const maxCount = dishes[0].count;

    dom.topDishesList.innerHTML = dishes
      .map(
        (d) => `
        <div class="dish-row">
          <span class="dish-rank">#${d.rank}</span>
          <div class="dish-info">
            <span class="dish-name">${d.name}</span>
            <span class="dish-revenue">₹${d.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="dish-bar-wrap">
            <div class="dish-bar" style="width:${(d.count / maxCount) * 100}%"></div>
          </div>
          <span class="dish-count">${d.count}</span>
        </div>
      `
      )
      .join('');
  }

  function renderTimeSlots(slots) {
    if (!slots || slots.every((s) => s.orders === 0)) {
      dom.timeSlotsList.innerHTML = '<div class="analytics-empty">No time-of-day data yet</div>';
      return;
    }

    const maxRevenue = Math.max(...slots.map((s) => s.revenue));

    dom.timeSlotsList.innerHTML = slots
      .filter((s) => s.orders > 0)
      .map(
        (s) => `
        <div class="slot-row">
          <span class="slot-label">${s.label}</span>
          <div class="slot-bar-wrap">
            <div class="slot-bar" style="width:${maxRevenue > 0 ? (s.revenue / maxRevenue) * 100 : 0}%"></div>
          </div>
          <div class="slot-stats">
            <span class="slot-revenue">₹${s.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span class="slot-orders">${s.orders} order${s.orders !== 1 ? 's' : ''}</span>
          </div>
        </div>
      `
      )
      .join('');
  }

  // ─── Event Listeners ─────────────────────────────────────────────────
  function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.mgr-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Add item form
    dom.menuForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const category = dom.itemCategory.value;
      const name = dom.itemName.value.trim();
      const price = parseFloat(dom.itemPrice.value);

      if (!name || isNaN(price) || price <= 0) {
        showToast('⚠️ Please fill in all fields correctly', 'error');
        return;
      }

      addItem(category, name, price);
    });

    // Edit modal save
    dom.editSave.addEventListener('click', () => {
      if (!state.editingItem) return;
      const { category, item } = state.editingItem;
      const name = dom.editName.value.trim();
      const price = parseFloat(dom.editPrice.value);
      const available = dom.editAvailable.checked;

      if (!name || isNaN(price) || price <= 0) {
        showToast('⚠️ Invalid values', 'error');
        return;
      }

      updateItem(category, item.id, { name, price, available });
    });

    // Edit modal cancel
    dom.editCancel.addEventListener('click', closeEditModal);

    // Close edit modal on overlay click
    dom.editModal.addEventListener('click', (e) => {
      if (e.target === dom.editModal) closeEditModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeEditModal();
    });
  }

  // ─── Start ───────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
