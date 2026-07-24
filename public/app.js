const ordersBody = document.getElementById('orders-body');
const eventsList = document.getElementById('events-list');
const statusEl   = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');

// ── Helpers ────────────────────────────────────────────────

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
};

const escapeHtml = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const statusBadge = (status) =>
  `<span class="status-badge ${status}">${status}</span>`;

const buildRow = (order) => {
  const tr = document.createElement('tr');
  tr.id = `order-${order.id}`;
  tr.innerHTML = `
    <td>${order.id}</td>
    <td>${escapeHtml(order.customer_name)}</td>
    <td>${escapeHtml(order.product_name)}</td>
    <td>${statusBadge(order.status)}</td>
    <td>${formatDate(order.updated_at)}</td>`;
  return tr;
};

const flashRow = (tr) => {
  tr.classList.remove('flash');
  // Force reflow so re-adding the class restarts the animation
  void tr.offsetWidth;
  tr.classList.add('flash');
};

const addEvent = (operation, text) => {
  // Remove the "Waiting…" placeholder
  const empty = eventsList.querySelector('.empty');
  if (empty) empty.remove();

  const li = document.createElement('li');
  li.innerHTML = `<span class="event-tag ${operation}">${operation}</span> ${text}`;
  eventsList.prepend(li);

  // Keep at most 50 events
  while (eventsList.children.length > 50) {
    eventsList.lastElementChild.remove();
  }
};

// ── Initial load ───────────────────────────────────────────

const loadOrders = async () => {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const orders = await res.json();
    ordersBody.innerHTML = '';

    if (orders.length === 0) {
      ordersBody.innerHTML = '<tr id="empty-row"><td colspan="5">No orders yet</td></tr>';
      return;
    }

    orders.forEach((order) => ordersBody.appendChild(buildRow(order)));
  } catch {
    ordersBody.innerHTML = '<tr><td colspan="5">Failed to load orders</td></tr>';
  }
};

loadOrders();

// ── Socket.IO ──────────────────────────────────────────────

const socket = io();

socket.on('connect', () => {
  statusEl.className = 'status connected';
  statusText.textContent = 'Connected';
});

socket.on('disconnect', () => {
  statusEl.className = 'status disconnected';
  statusText.textContent = 'Disconnected';
});

socket.on('order-change', ({ operation, data }) => {
  // Remove the "No orders yet" placeholder if present
  const emptyRow = document.getElementById('empty-row');
  if (emptyRow) emptyRow.remove();

  const existing = document.getElementById(`order-${data.id}`);

  if (operation === 'DELETE') {
    if (existing) existing.remove();
    addEvent('DELETE', `Order #${data.id} deleted`);

    // Show placeholder if table is now empty
    if (ordersBody.children.length === 0) {
      ordersBody.innerHTML = '<tr id="empty-row"><td colspan="5">No orders yet</td></tr>';
    }
    return;
  }

  if (operation === 'INSERT') {
    const tr = buildRow(data);
    ordersBody.appendChild(tr);
    flashRow(tr);
    addEvent('INSERT', `Order #${data.id} created`);
    return;
  }

  if (operation === 'UPDATE') {
    if (existing) {
      const tr = buildRow(data);
      existing.replaceWith(tr);
      flashRow(tr);
    } else {
      const tr = buildRow(data);
      ordersBody.appendChild(tr);
      flashRow(tr);
    }
    addEvent('UPDATE', `Order #${data.id} changed to ${data.status}`);
  }
});
