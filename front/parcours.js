// ─── Auth Guard — wrapped in DOMContentLoaded to prevent early execution ──────
// IMPORTANT: This MUST be inside DOMContentLoaded to avoid redirect loops
// Uses replace() to prevent back-button infinite loop

document.addEventListener('DOMContentLoaded', function() {
  // Single auth guard - executed only once when DOM is ready
  if (typeof Auth !== 'undefined') {
    const isLoginPage = window.location.pathname.includes('login.html');
    const token = Auth.getToken();
    const expired = Auth.isExpired();

    if ((!token || expired) && !isLoginPage) {
      // Use replace() to prevent back-button redirect loop
      window.location.replace('/Prospectly/login.html');
      return; // Stop execution after redirect
    }

    // Setup auth bar only if user is authenticated
    if (token && !expired) {
      const usernameDisplay = document.getElementById('usernameDisplay');
      const logoutBtn = document.getElementById('logoutBtn');
      
      if (usernameDisplay) {
        usernameDisplay.textContent = Auth.getUsername() ?? '';
      }
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => Auth.logout());
      }
    }
  }
});

const statusEl = document.getElementById('status');
const listEl = document.getElementById('parcoursList');
const startAddressInput = document.getElementById('startAddressInput');
const saveStartAddressBtn = document.getElementById('saveStartAddressBtn');

let allParcours = [];
let currentFilter = 'all';
let user = null;

async function loadUser() {
  const res = await fetch(`${API_URL}/me`, {
    headers: Auth.authHeaders(),
  });
  if (res.status === 401) Auth.logout();
  if (!res.ok) {
    console.error(`[loadUser] Erreur ${res.status}: ${res.statusText}`);
    return;
  }

  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    console.error('[loadUser] Response n\'est pas du JSON');
    return;
  }

  user = await res.json();
  startAddressInput.value = user.start_address ?? '';
}

async function saveStartAddress() {
  const value = startAddressInput.value.trim();

  try {
    const res = await fetch(`${API_URL}/me`, {
      method: 'PATCH',
      headers: Auth.authHeaders(),
      body: JSON.stringify({ start_address: value }),
    });

    if (res.status === 401) Auth.logout();
    if (!res.ok) throw new Error('Erreur sauvegarde adresse');

    user.start_address = value;
    setStatus('Adresse enregistrée');
    setTimeout(clearStatus, 1000);
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function loadParcours() {
  setStatus('Chargement...');

  try {
    const res = await fetch(`${API_URL}/parcours`, {
      headers: Auth.authHeaders(),
    });

    if (res.status === 401) Auth.logout();
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);

    const data = await res.json();
    allParcours = data.parcours ?? [];

    clearStatus();
    renderParcours();
  } catch (err) {
    setStatus(err.message, true);
  }
}

function renderParcours() {
  const filtered = allParcours.filter((p) => {
    if (currentFilter === 'all') return true;
    return p.status === currentFilter;
  });

  if (!filtered.length) {
    listEl.innerHTML = '<p class="empty-state">Aucun prospect dans cette catégorie.</p>';
    return;
  }

  listEl.innerHTML = filtered.map(p => {
    // Determine status class for card styling
    const statusClass = p.status === 'done' ? 'status-done' : p.status === 'not_done' ? 'status-not-done' : 'status-todo';
    
    return `
    <div class="parcours-card ${statusClass}" data-id="${p.id}">
      <div class="parcours-body">
        <div class="card-name">${escape(p.name)}</div>
        ${p.address ? `<div class="card-address">${escape(p.address)}</div>` : ''}
        ${p.phone ? `<div><a href="tel:${escape(p.phone)}">${escape(p.phone)}</a></div>` : ''}

        <div class="parcours-status-row">
          <select class="status-select" data-id="${p.id}">
            <option value="todo" ${p.status === 'todo' ? 'selected' : ''}>À faire</option>
            <option value="done" ${p.status === 'done' ? 'selected' : ''}>Fait</option>
            <option value="not_done" ${p.status === 'not_done' ? 'selected' : ''}>Non fait</option>
          </select>

          ${mapsLink(p)}

          <button class="btn-delete" data-id="${p.id}">Supprimer</button>
        </div>
      </div>
    </div>
  `}).join('');

  listEl.querySelectorAll('.status-select').forEach(el => {
    el.addEventListener('change', e => {
      updateProspect(e.target.dataset.id, { status: e.target.value });
    });
  });

  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => deleteParcours(e.target.dataset.id));
  });
}

async function updateProspect(id, payload) {
  try {
    const res = await fetch(`${API_URL}/parcours/${id}`, {
      method: 'PATCH',
      headers: Auth.authHeaders(),
      body: JSON.stringify(payload),
    });

    if (res.status === 401) Auth.logout();
    if (!res.ok) throw new Error('Erreur update');

    const item = allParcours.find(p => p.id == id);
    if (item) Object.assign(item, payload);

    renderParcours();
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function deleteParcours(id) {
  if (!confirm('Supprimer ce prospect ?')) return;

  try {
    const res = await fetch(`${API_URL}/parcours/${id}`, {
      method: 'DELETE',
      headers: Auth.authHeaders(),
    });

    if (res.status === 401) Auth.logout();

    allParcours = allParcours.filter(p => p.id != id);
    renderParcours();
  } catch (err) {
    setStatus(err.message, true);
  }
}

document.querySelectorAll('#parcoursFilters .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#parcoursFilters .filter-btn')
      .forEach(b => b.classList.remove('active'));

    btn.classList.add('active');
    currentFilter = btn.dataset.status;
    renderParcours();
  });
});

saveStartAddressBtn.addEventListener('click', saveStartAddress);

function mapsLink(item) {
  if (!item.address) return '';

  const origin = encodeURIComponent(user?.start_address || '');
  const destination = encodeURIComponent(item.address);

  const href = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
    : `https://www.google.com/maps/search/?api=1&query=${destination}`;

  return `<a class="filter-btn" href="${href}" target="_blank" rel="noopener">Maps</a>`;
}

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setStatus(msg, error = false) {
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden', 'error');
  if (error) statusEl.classList.add('error');
}

function clearStatus() {
  statusEl.classList.add('hidden');
}

async function init() {
  await loadUser();
  await loadParcours();
}

init();