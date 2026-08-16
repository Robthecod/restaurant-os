(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  const state = {
    menu: null,
    editingItem: null, // { category, item }
    socketConnected: false,
    openRequests: [], // open ingredient requests
    openReports: [], // open help/complaint reports
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
    qsCategories: $('#qsCategories'),
    editModal: $('#editModal'),
    editName: $('#editName'),
    editPrice: $('#editPrice'),
    editAvailable: $('#editAvailable'),
    editCancel: $('#editCancel'),
    editSave: $('#editSave'),
    toastContainer: $('#toastContainer'),
    mgrSubtitle: $('#mgrSubtitle'),
    newCategoryKey: $('#newCategoryKey'),
    newCategoryName: $('#newCategoryName'),
    addCategoryBtn: $('#addCategoryBtn'),
    menuView: $('#menuView'),
    analyticsView: $('#analyticsView'),
    analyticsLoading: $('#analyticsLoading'),
    analyticsContent: $('#analyticsContent'),
    analyticsSummary: $('#analyticsSummary'),
    analyticsPeriods: $('#analyticsPeriods'),
    analyticsSales: $('#analyticsSales'),
    topDishesList: $('#topDishesList'),
    timeSlotsList: $('#timeSlotsList'),
    wastageTotal: $('#wastageTotal'),
    wastageCount: $('#wastageCount'),
    notifBell: $('#notifBell'),
    notifBadge: $('#notifBadge'),
    notifContainer: $('#notifContainer'),
    notifDropdown: $('#notifDropdown'),
    notifDropdownBody: $('#notifDropdownBody'),
    notifDropdownClose: $('#notifDropdownClose'),
  };

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    setupSocket();
    fetchMenu();
    fetchAnalytics();
    fetchOpenRequests();
    fetchOpenReports();
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
      // Re-fetch open requests on reconnect to stay in sync
      fetchOpenRequests();
      fetchOpenReports();
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
      showToast('Menu synced to all devices', 'info');
    });

    // ─── Notification Socket Events ────────────────────────────────────
    client.on('new_ingredient_request', (request) => {
      // Add to our list if it's open
      if (request.status === 'open') {
        state.openRequests.unshift(request);
        updateBadge();
        updateDropdown();
        // Only show toast if dropdown is closed (to avoid spam when already viewing)
        if (dom.notifDropdown.style.display === 'none') {
          showToast(`📦 Request: ${request.ingredient} — ${request.quantity} (${request.requestedBy})`, 'info');
        }
      }
    });

    client.on('ingredient_request_resolved', (request) => {
      state.openRequests = state.openRequests.filter((r) => r.id !== request.id);
      updateBadge();
      updateDropdown();
    });

    client.on('new_help_report', (report) => {
      if (report.status === 'open') {
        state.openReports.unshift(report);
        updateBadge();
        updateDropdown();
        // Only show toast if dropdown is closed (to avoid spam when already viewing)
        if (dom.notifDropdown.style.display === 'none') {
          showToast(`🆘 ${report.title} (${report.requestedBy})`, 'info');
        }
      }
    });

    client.on('help_report_resolved', (report) => {
      state.openReports = state.openReports.filter((r) => r.id !== report.id);
      updateBadge();
      updateDropdown();
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
          <div>Failed to load menu. <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button></div>
        </div>
      `;
    }
  }

  // ─── Add Item ────────────────────────────────────────────────────────
  async function addItem(category, name, price) {
    const submitBtn = dom.menuForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

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
      showToast(`Added "${item.name}" to ${category}`, 'success');
      dom.itemName.value = '';
      dom.itemPrice.value = '';
      dom.itemName.focus();
    } catch (err) {
      console.error('Add item error:', err);
      showToast(`${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '+ Add to Menu';
    }
  }

  // ─── Update Item ─────────────────────────────────────────────────────
  async function updateItem(category, itemId, data) {
    dom.editSave.disabled = true;
    dom.editSave.textContent = 'Saving...';

    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to update item');

      const item = await res.json();
      showToast(`Updated "${item.name}"`, 'success');
      dom.editModal.classList.remove('active');
      state.editingItem = null;
    } catch (err) {
      console.error('Update item error:', err);
      showToast(`${err.message}`, 'error');
    } finally {
      dom.editSave.disabled = false;
      dom.editSave.textContent = 'Save Changes';
    }
  }

  // ─── Add Category ─────────────────────────────────────────────────────
  async function addCategory() {
    const key = dom.newCategoryKey.value.trim().toLowerCase().replace(/\s+/g, '_');
    const name = dom.newCategoryName.value.trim();

    if (!key || !name) {
      showToast('Please enter both a key and display name', 'error');
      return;
    }

    dom.addCategoryBtn.disabled = true;
    dom.addCategoryBtn.textContent = 'Adding...';

    try {
      const res = await fetch('/api/menu/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, name }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add category');
      }

      showToast(`Added category "${name}"`, 'success');
      dom.newCategoryKey.value = '';
      dom.newCategoryName.value = '';
      dom.newCategoryKey.focus();
    } catch (err) {
      console.error('Add category error:', err);
      showToast(`${err.message}`, 'error');
    } finally {
      dom.addCategoryBtn.disabled = false;
      dom.addCategoryBtn.textContent = '+ Add Category';
    }
  }

  // ─── Delete Item ─────────────────────────────────────────────────────
  async function deleteItem(itemId) {
    if (!confirm('Delete this item? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/menu/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      showToast('Item deleted', 'info');
    } catch (err) {
      console.error('Delete item error:', err);
      showToast(`${err.message}`, 'error');
    }
  }

  // ─── Render Menu Preview ─────────────────────────────────────────────
  const categoryLabels = {
    starters: 'Starters',
    mains: 'Mains',
    desserts: 'Desserts',
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
      const label = categoryLabels[cat] || cat;

      html += `
        <div class="preview-category">
          <div class="preview-category-header">
            <h3>${label}</h3>
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
                      <button class="edit-btn" data-category="${cat}" data-id="${item.id}" title="Edit">Edit</button>
                      <button class="delete-btn" data-category="${cat}" data-id="${item.id}" title="Delete">Delete</button>
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
    dom.qsCategories.textContent = categories.length;
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

  // ─── Notification Functions ───────────────────────────────────────────
  async function fetchOpenRequests() {
    try {
      const res = await fetch('/api/ingredient-requests');
      if (res.ok) {
        state.openRequests = await res.json();
        updateBadge();
      }
    } catch (err) {
      console.error('Failed to fetch open requests:', err);
    }
  }

  async function fetchOpenReports() {
    try {
      const res = await fetch('/api/help-reports');
      if (res.ok) {
        state.openReports = await res.json();
        updateBadge();
      }
    } catch (err) {
      console.error('Failed to fetch open help reports:', err);
    }
  }

  function updateBadge() {
    const count = state.openRequests.length + state.openReports.length;
    dom.notifBadge.textContent = count;
    dom.notifBadge.style.display = count > 0 ? 'flex' : 'none';
    dom.notifBell.classList.toggle('has-requests', count > 0);
  }

  function updateDropdown() {
    const requests = state.openRequests;
    const reports = state.openReports;

    if (requests.length === 0 && reports.length === 0) {
      dom.notifDropdownBody.innerHTML = '<div class="notif-empty">No pending notifications</div>';
      return;
    }

    let html = '';

    if (requests.length > 0) {
      html += '<div class="notif-section-label">📦 Ingredient Requests</div>';
      html += requests
        .map(
          (r) => `
        <div class="notif-item new">
          <div class="notif-item-icon">📦</div>
          <div class="notif-item-body">
            <div class="notif-item-title">${escapeHtml(r.ingredient)} — ${escapeHtml(r.quantity)}</div>
            <div class="notif-item-meta">Requested by ${escapeHtml(r.requestedBy)}${r.tableNumber ? ' (Table ' + escapeHtml(r.tableNumber) + ')' : ''}</div>
            <div class="notif-item-actions">
              <button class="notif-resolve-btn" data-request-id="${r.id}">✓ Resolved</button>
            </div>
          </div>
        </div>
      `
        )
        .join('');
    }

    if (reports.length > 0) {
      html += '<div class="notif-section-label">🆘 Help Reports</div>';
      html += reports
        .map(
          (r) => `
        <div class="notif-item new">
          <div class="notif-item-icon">🆘</div>
          <div class="notif-item-body">
            <div class="notif-item-title">${escapeHtml(r.title)}</div>
            <div class="notif-item-desc">${escapeHtml(r.description)}</div>
            <div class="notif-item-meta">Reported by ${escapeHtml(r.requestedBy)}${r.tableNumber ? ' (Table ' + escapeHtml(r.tableNumber) + ')' : ''}</div>
            <div class="notif-item-actions">
              <button class="notif-resolve-btn" data-report-id="${r.id}">✓ Resolved</button>
            </div>
          </div>
        </div>
      `
        )
        .join('');
    }

    dom.notifDropdownBody.innerHTML = html;

    // Attach resolve handlers
    dom.notifDropdownBody.querySelectorAll('.notif-resolve-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const el = e.target;
        el.disabled = true;
        el.textContent = 'Resolving...';
        if (el.dataset.requestId) {
          await resolveRequest(parseInt(el.dataset.requestId));
        } else if (el.dataset.reportId) {
          await resolveReport(parseInt(el.dataset.reportId));
        }
      });
    });
  }

  async function resolveReport(id) {
    try {
      const res = await fetch(`/api/help-reports/${id}/resolve`, { method: 'PATCH' });
      if (res.ok) {
        state.openReports = state.openReports.filter((r) => r.id !== id);
        updateBadge();
        updateDropdown();
        showToast('✅ Report marked as resolved', 'success');
      } else {
        showToast('Failed to resolve report', 'error');
      }
    } catch (err) {
      console.error('Resolve report error:', err);
      showToast('Failed to resolve report', 'error');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function resolveRequest(id) {
    try {
      const res = await fetch(`/api/ingredient-requests/${id}/resolve`, { method: 'PATCH' });
      if (res.ok) {
        state.openRequests = state.openRequests.filter((r) => r.id !== id);
        updateBadge();
        updateDropdown();
        showToast('✅ Request marked as resolved', 'success');
      } else {
        showToast('Failed to resolve request', 'error');
      }
    } catch (err) {
      console.error('Resolve request error:', err);
      showToast('Failed to resolve request', 'error');
    }
  }

  function toggleDropdown() {
    const isOpen = dom.notifDropdown.style.display !== 'none';
    dom.notifDropdown.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      updateDropdown(); // Refresh when opening
    }
  }

  function closeDropdown() {
    dom.notifDropdown.style.display = 'none';
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
          <div>Failed to load analytics. <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button></div>
        </div>
      `;
    }
  }

  // ─── Render Analytics ────────────────────────────────────────────────
  function renderAnalytics(data) {
    renderSummary(data.summary);
    renderPeriods(data.periods);
    renderSales(data.sales);
    renderTopDishes(data.topDishes);
    renderTimeSlots(data.timeSlots);
    renderWastage(data.summary);
  }

  function renderWastage(summary) {
    const totalWastage = summary.totalWastage || 0;
    const totalReturns = summary.totalReturns || 0;
    if (dom.wastageTotal) {
      dom.wastageTotal.textContent = `₹${totalWastage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
    if (dom.wastageCount) {
      dom.wastageCount.textContent = totalReturns;
    }
  }

  function renderSummary(summary) {
    dom.analyticsSummary.innerHTML = `        <div class="analytics-stat-card highlight">
          <span class="analytics-stat-value">₹${summary.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        <span class="analytics-stat-label">Total Revenue</span>
      </div>        <div class="analytics-stat-card">
          <span class="analytics-stat-value">${summary.totalOrders}</span>
        <span class="analytics-stat-label">Orders Completed</span>
      </div>        <div class="analytics-stat-card">
          <span class="analytics-stat-value">${summary.totalItemsSold}</span>
        <span class="analytics-stat-label">Items Sold</span>
      </div>        <div class="analytics-stat-card">
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

  // ─── Sales Breakdown (yearly total + month/week/day chart) ──────────
  const fmtINR = (n) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  function renderSales(sales) {
    if (!dom.analyticsSales || !sales) return;

    dom.analyticsSales.innerHTML = `
      <h3 class="analytics-card-title">📈 Sales Breakdown</h3>
      <div class="sales-header">
        <div class="sales-yearly">
          <span class="sales-yearly-label">Yearly Sales · ${new Date().getFullYear()}</span>
          <span class="sales-yearly-value">${fmtINR(sales.thisYear.revenue)}</span>
          <span class="sales-yearly-sub">${sales.thisYear.orders} orders${sales.lastYear.revenue ? ' · Last year ' + fmtINR(sales.lastYear.revenue) : ''}</span>
        </div>
        <div class="sales-tabs">
          <button class="sales-tab active" data-range="month">Month</button>
          <button class="sales-tab" data-range="week">Week</button>
          <button class="sales-tab" data-range="day">Day</button>
        </div>
      </div>
      <div class="sales-chart" id="salesChart"></div>
      <div class="sales-legend" id="salesLegend"></div>
    `;

    renderSalesChart(sales, 'month');

    dom.analyticsSales.querySelectorAll('.sales-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.analyticsSales.querySelectorAll('.sales-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderSalesChart(sales, btn.dataset.range);
      });
    });
  }

  function renderSalesChart(sales, range) {
    const chart = dom.analyticsSales.querySelector('#salesChart');
    const legend = dom.analyticsSales.querySelector('#salesLegend');
    if (!chart || !sales) return;

    const series = sales['by' + range.charAt(0).toUpperCase() + range.slice(1)] || [];
    const max = Math.max(...series.map((s) => s.revenue), 1);

    chart.innerHTML = series
      .map((s) => {
        const h = Math.max(4, Math.round((s.revenue / max) * 100));
        return `
        <div class="sales-bar-col" title="${escapeHtml(s.fullLabel || s.label)}: ${fmtINR(s.revenue)} (${s.orders} orders)">
          <div class="sales-bar-track">
            <div class="sales-bar" style="height:${h}%"></div>
          </div>
          <span class="sales-bar-label">${escapeHtml(s.label)}</span>
          <span class="sales-bar-value">${s.revenue > 0 ? fmtINR(s.revenue) : ''}</span>
        </div>
      `;
      })
      .join('');

    const rangeLabel = range === 'month' ? 'Month' : range === 'week' ? 'Week' : 'Day';
    legend.innerHTML = `<span>Highest ${rangeLabel.toLowerCase()}: <strong>${fmtINR(max)}</strong></span>`;
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

    // Add category
    dom.addCategoryBtn.addEventListener('click', addCategory);
    dom.newCategoryKey.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        dom.newCategoryName.focus();
      }
    });
    dom.newCategoryName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCategory();
      }
    });

    // Add item form
    dom.menuForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const category = dom.itemCategory.value;
      const name = dom.itemName.value.trim();
      const price = parseFloat(dom.itemPrice.value);

      if (!name || isNaN(price) || price <= 0) {
        showToast('Please fill in all fields correctly', 'error');
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
        showToast('Invalid values', 'error');
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
      if (e.key === 'Escape') {
        closeEditModal();
        closeDropdown();
      }
    });

    // Notification bell toggle
    dom.notifBell.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    // Notification dropdown close
    dom.notifDropdownClose.addEventListener('click', closeDropdown);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dom.notifContainer.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  // ─── Start ───────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
