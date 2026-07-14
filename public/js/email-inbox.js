/* ─── Email Inbox Dashboard ───────────────────────────────────────── */
/* AI-ready lead management for Roux restaurant business            */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  const state = {
    filter: 'all',
    statusFilter: 'all',
    leads: [],
    selectedLead: null,
    selectedType: null,
  };

  // ─── DOM Cache ──────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const dom = {
    sidebar: document.querySelector('.sidebar'),
    hamburger: $('hamburgerBtn'),
    pageTitle: $('pageTitle'),
    refreshBtn: $('refreshBtn'),
    leadItems: $('leadItems'),
    leadDetail: $('leadDetail'),
    detailEmpty: $('detailEmpty'),
    detailContent: $('detailContent'),
    statusFilter: $('statusFilter'),
    dhStatus: $('dhStatus'),
    dhName: $('dhName'),
    dhMeta: $('dhMeta'),
    btnMarkHandled: $('btnMarkHandled'),
    btnReply: $('btnReply'),
    diGrid: $('diGrid'),
    diMessage: $('diMessage'),
    diMessageSection: $('diMessageSection'),
    convList: $('convList'),
    replyForm: $('replyForm'),
    replySubject: $('replySubject'),
    replyMessage: $('replyMessage'),
    replySend: $('replySend'),
    replyCancel: $('replyCancel'),
    toastContainer: $('toastContainer'),
    statTotal: $('statTotal'),
    statDemos: $('statDemos'),
    statSignups: $('statSignups'),
    statPending: $('statPending'),
    statNewsletter: $('statNewsletter'),
    countAll: $('countAll'),
    countDemo: $('countDemo'),
    countSignup: $('countSignup'),
    countNewsletter: $('countNewsletter'),
    countPending: $('countPending'),
    connDot: document.querySelector('.sf-dot'),
  };

  // ─── Helpers ────────────────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function formatDateFull(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function showToast(message, type) {
    type = type || 'success';
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('removing');
      setTimeout(function () { toast.remove(); }, 250);
    }, 3500);
  }

  function getLeadTypeIcon(type) {
    if (type === 'demo') return '\uD83D\uDCC5';
    if (type === 'signup') return '\uD83D\uDE80';
    return '\uD83D\uDCEC';
  }

  // ─── Fetch Leads ────────────────────────────────────────────────────
  async function fetchLeads() {
    var params = new URLSearchParams({ type: state.filter });
    if (state.statusFilter !== 'all') {
      params.set('status', state.statusFilter);
    }

    try {
      var res = await fetch('/api/leads?' + params.toString());
      var data = await res.json();
      state.leads = data.leads || [];
      renderStats(data);
      renderList();
      renderSidebarCounts(data);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
      dom.leadItems.innerHTML = [
        '<div class="lead-empty">',
        '  <span class="le-icon">\u26A0\uFE0F</span>',
        '  <span class="le-text">Failed to load leads</span>',
        '  <span class="le-sub">Check your connection and try again</span>',
        '</div>',
      ].join('\n');
    }
  }

  // ─── Fetch Single Lead ──────────────────────────────────────────────
  async function fetchLeadDetail(type, id) {
    try {
      var res = await fetch('/api/leads/' + type + '/' + id);
      var data = await res.json();
      state.selectedLead = data.lead;
      state.selectedType = type;
      renderDetail(data);
    } catch (err) {
      console.error('Failed to fetch lead detail:', err);
      showToast('Failed to load lead details', 'error');
    }
  }

  // ─── Render Stats ───────────────────────────────────────────────────
  function renderStats(data) {
    dom.statTotal.textContent = data.total || 0;
    dom.statDemos.textContent = data.demosCount || 0;
    dom.statSignups.textContent = data.signupsCount || 0;
    dom.statPending.textContent = data.pendingCount || 0;
    dom.statNewsletter.textContent = data.newslettersCount || 0;
  }

  // ─── Render Sidebar Counts ──────────────────────────────────────────
  function renderSidebarCounts(data) {
    dom.countAll.textContent = data.total || 0;
    dom.countDemo.textContent = data.demosCount || 0;
    dom.countSignup.textContent = data.signupsCount || 0;
    dom.countNewsletter.textContent = data.newslettersCount || 0;
    dom.countPending.textContent = data.pendingCount || 0;
  }

  // ─── Render Lead List ───────────────────────────────────────────────
  function renderList() {
    if (state.leads.length === 0) {
      var emptyMsg = (state.filter === 'all')
        ? 'Leads will appear here when people sign up or request demos'
        : 'No leads in this category';
      dom.leadItems.innerHTML = [
        '<div class="lead-empty">',
        '  <span class="le-icon">\uD83D\uDCED</span>',
        '  <span class="le-text">No leads found</span>',
        '  <span class="le-sub">' + emptyMsg + '</span>',
        '</div>',
      ].join('\n');
      return;
    }

    dom.leadItems.innerHTML = state.leads.map(function (lead) {
      var type = lead.leadType || 'demo';
      var name = lead.name || lead.email || 'Anonymous';
      var restaurant = lead.restaurant || '';
      var time = formatDate(lead.createdAt || lead.subscribedAt);
      var status = lead.status || 'pending';
      var isActive = state.selectedLead && state.selectedLead.id === lead.id && state.selectedType === type;
      var icon = getLeadTypeIcon(type);

      var html = '<div class="lead-item' + (isActive ? ' active' : '') + '"';
      html += ' data-type="' + type + '" data-id="' + lead.id + '">';
      html += '  <div class="li-avatar ' + type + '">' + icon + '</div>';
      html += '  <div class="li-body">';
      html += '    <div class="li-top">';
      html += '      <span class="li-name">' + escapeHtml(name) + '</span>';
      html += '      <span class="li-time">' + time + '</span>';
      html += '    </div>';
      html += '    <div class="li-restaurant">' + (restaurant ? escapeHtml(restaurant) : escapeHtml(lead.email || '')) + '</div>';
      html += '    <div class="li-bottom">';
      html += '      <span class="li-badge ' + type + '">' + type + '</span>';
      html += '      <span class="li-badge ' + status + '">' + status + '</span>';
      html += '    </div>';
      html += '  </div>';
      html += '</div>';
      return html;
    }).join('\n');

    // Attach click listeners
    var items = dom.leadItems.querySelectorAll('.lead-item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        var type = this.dataset.type;
        var id = parseInt(this.dataset.id);
        // Deselect all
        var allItems = dom.leadItems.querySelectorAll('.lead-item');
        for (var j = 0; j < allItems.length; j++) {
          allItems[j].classList.remove('active');
        }
        this.classList.add('active');
        fetchLeadDetail(type, id);
      });
    }
  }

  // ─── Render Detail ──────────────────────────────────────────────────
  function renderDetail(data) {
    var lead = data.lead;
    var conversations = data.conversations || [];
    var type = lead.leadType || 'demo';

    dom.detailEmpty.style.display = 'none';
    dom.detailContent.style.display = 'flex';

    // Status badge
    var status = lead.status || 'pending';
    var statusLabels = { pending: '\u23F3 Pending', active: '\u2705 Active', handled: '\uD83D\uDCCC Handled' };
    dom.dhStatus.className = 'dh-status ' + status;
    dom.dhStatus.textContent = statusLabels[status] || status;

    // Name & meta
    var name = lead.name || lead.email || 'Anonymous';
    var restaurant = lead.restaurant ? ' \u00B7 ' + lead.restaurant : '';
    var phone = lead.phone ? ' \u00B7 ' + lead.phone : '';
    dom.dhName.textContent = name;
    dom.dhMeta.textContent = lead.email + restaurant + phone;

    // Mark handled button
    var isPending = status === 'pending' || status === 'active';
    dom.btnMarkHandled.className = 'dh-btn dh-btn-handle' + (isPending ? '' : ' done');
    dom.btnMarkHandled.textContent = isPending ? '\u2705 Mark Handled' : '\uD83D\uDCCC Handled';

    // Contact details grid
    var fields = [
      { label: 'Email', value: lead.email },
      { label: 'Type', value: type.charAt(0).toUpperCase() + type.slice(1) },
    ];
    if (restaurant) fields.push({ label: 'Restaurant', value: lead.restaurant });
    if (lead.phone) fields.push({ label: 'Phone', value: lead.phone });
    if (lead.preferredDate) fields.push({ label: 'Preferred Date', value: lead.preferredDate });
    if (lead.teamSize) fields.push({ label: 'Team Size', value: lead.teamSize });
    if (lead.createdAt) fields.push({ label: 'Submitted', value: formatDateFull(lead.createdAt) });
    if (lead.subscribedAt) fields.push({ label: 'Subscribed', value: formatDateFull(lead.subscribedAt) });

    var gridHtml = fields.map(function (f) {
      return '<div class="di-field">'
        + '<span class="di-field-label">' + f.label + '</span>'
        + '<span class="di-field-value">' + escapeHtml(f.value) + '</span>'
        + '</div>';
    }).join('\n');
    dom.diGrid.innerHTML = gridHtml;

    // Message section
    if (lead.message) {
      dom.diMessageSection.style.display = 'block';
      dom.diMessage.textContent = lead.message;
    } else {
      dom.diMessageSection.style.display = 'none';
    }

    // Conversation history
    if (conversations.length === 0) {
      dom.convList.innerHTML = '<div class="conv-empty">No conversations yet</div>';
    } else {
      var convHtml = conversations.map(function (c) {
        var dirLabel = c.direction === 'outgoing' ? '\uD83D\uDCE4 You replied' : '\uD83D\uDCE5 They said';
        var badgeClass = c.delivered ? 'sent' : 'failed';
        var badgeText = c.delivered ? '\u2713 Sent' : '\u2717 Failed';
        return '<div class="conv-item ' + c.direction + '">'
          + '<div class="conv-header">'
          + '  <span>' + dirLabel + '</span>'
          + '  <span>' + formatDateFull(c.sentAt) + ' <span class="conv-badge ' + badgeClass + '">' + badgeText + '</span></span>'
          + '</div>'
          + '<div class="conv-body">'
          + '  <strong>' + escapeHtml(c.subject || '') + '</strong><br>'
          + '  ' + escapeHtml(c.message || '')
          + '</div>'
          + '</div>';
      }).join('\n');
      dom.convList.innerHTML = convHtml;
    }

    // Hide reply form
    dom.replyForm.style.display = 'none';
  }

  // ─── Escape HTML ────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Mark Lead as Handled ───────────────────────────────────────────
  async function markHandled() {
    if (!state.selectedLead || !state.selectedType) return;

    var currentStatus = state.selectedLead.status || 'pending';
    var newStatus = currentStatus === 'handled' ? 'active' : 'handled';

    try {
      var res = await fetch('/api/leads/' + state.selectedType + '/' + state.selectedLead.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update');

      var updated = await res.json();
      state.selectedLead.status = updated.status;

      var label = updated.status === 'handled' ? 'marked as handled' : 'reactivated';
      showToast('\u2705 Lead ' + label);
      renderDetail({ lead: updated, conversations: [] });
      fetchLeads();
    } catch (err) {
      showToast('Failed to update lead', 'error');
    }
  }

  // ─── Send Reply ─────────────────────────────────────────────────────
  async function sendReply() {
    if (!state.selectedLead || !state.selectedType) return;

    var message = dom.replyMessage.value.trim();
    var subject = dom.replySubject.value.trim() || '';

    if (!message) {
      showToast('Please write a message', 'error');
      return;
    }

    dom.replySend.disabled = true;
    dom.replySend.textContent = '\u23F3 Sending...';

    try {
      var res = await fetch('/api/leads/' + state.selectedType + '/' + state.selectedLead.id + '/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, subject: subject }),
      });

      if (!res.ok) throw new Error('Failed to send reply');

      showToast('\u2709\uFE0F Reply sent successfully');
      dom.replyForm.style.display = 'none';
      dom.replyMessage.value = '';
      dom.replySubject.value = '';

      fetchLeadDetail(state.selectedType, state.selectedLead.id);
    } catch (err) {
      showToast('Failed to send reply', 'error');
    } finally {
      dom.replySend.disabled = false;
      dom.replySend.textContent = '\u2709\uFE0F Send Reply';
    }
  }

  // ─── Set Active Sidebar Item ────────────────────────────────────────
  function setSidebarActive(filter) {
    var items = document.querySelectorAll('.sidebar-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].dataset.filter === filter);
    }

    var labels = {
      all: 'All Leads',
      demo: 'Demo Requests',
      signup: 'Free Trials',
      newsletter: 'Newsletters',
      pending: 'Pending',
    };
    dom.pageTitle.textContent = labels[filter] || 'Leads';
  }

  // ─── Init ───────────────────────────────────────────────────────────
  function init() {
    // Sidebar navigation
    var sidebarItems = document.querySelectorAll('.sidebar-item');
    for (var i = 0; i < sidebarItems.length; i++) {
      sidebarItems[i].addEventListener('click', function () {
        state.filter = this.dataset.filter;
        state.selectedLead = null;
        state.selectedType = null;
        dom.detailEmpty.style.display = 'flex';
        dom.detailContent.style.display = 'none';
        setSidebarActive(state.filter);
        fetchLeads();

        // Close sidebar on mobile
        dom.sidebar.classList.remove('open');
      });
    }

    // Hamburger toggle
    dom.hamburger.addEventListener('click', function () {
      dom.sidebar.classList.toggle('open');
    });

    // Status filter
    dom.statusFilter.addEventListener('change', function () {
      state.statusFilter = dom.statusFilter.value;
      fetchLeads();
    });

    // Refresh button
    dom.refreshBtn.addEventListener('click', fetchLeads);

    // Mark handled
    dom.btnMarkHandled.addEventListener('click', markHandled);

    // Reply button
    dom.btnReply.addEventListener('click', function () {
      dom.replyForm.style.display = 'block';
      dom.replySubject.value = 'Re: Your ' + (state.selectedType === 'demo' ? 'Demo Request' : 'Roux Signup');
      dom.replyMessage.focus();
    });

    // Reply cancel
    dom.replyCancel.addEventListener('click', function () {
      dom.replyForm.style.display = 'none';
    });

    // Reply send
    dom.replySend.addEventListener('click', sendReply);

    // Enter key to send (Shift+Enter for newline)
    dom.replyMessage.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendReply();
      }
    });

    // Socket.io for real-time updates
    var socket = io();
    socket.on('connect', function () {
      dom.connDot.className = 'sf-dot';
    });
    socket.on('disconnect', function () {
      dom.connDot.className = 'sf-dot disconnected';
    });
    socket.on('new_demo_booking', function () {
      showToast('\uD83D\uDCC5 New demo booking received!');
      fetchLeads();
    });
    socket.on('new_signup', function () {
      showToast('\uD83D\uDE80 New free trial signup!');
      fetchLeads();
    });
    socket.on('lead_updated', function () {
      if (state.selectedLead) {
        fetchLeadDetail(state.selectedType, state.selectedLead.id);
      }
      fetchLeads();
    });

    // Initial load
    fetchLeads();
  }

  // ─── Start ──────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
