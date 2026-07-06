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
  };

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    setupSocket();
    fetchMenu();
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

  // ─── Event Listeners ─────────────────────────────────────────────────
  function setupEventListeners() {
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
