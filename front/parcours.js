const isLoginPage = window.location.pathname.includes('login.html');

if (!Auth.getToken() && !isLoginPage) {
  window.location.href = '/Prospectly/login.html';
}

const statusEl = document.getElementById('status');
const listEl = document.getElementById('parcoursList');
const startAddressInput = document.getElementById('startAddressInput');
const saveStartAddressBtn = document.getElementById('saveStartAddressBtn');

document.getElementById('usernameDisplay').textContent = Auth.getUsername() ?? '';
document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());

let allParcours = [];
let currentFilter = 'all';
let user = null;

async function loadUser() {
  const res = await fetch(`${API_URL}/me`, {
    headers: Auth.authHeaders(),
  });
  if (res.status === 401) Auth.logout();

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
    if (currentFilter === 'tour') return p.in_tour === 1;
    return p.status === currentFilter;
  });

  if (!filtered.length) {
    listEl.innerHTML = '<p class="empty-state">Aucun prospect dans cette catégorie.</p>';
    return;
  }

  listEl.innerHTML = filtered.map(p => `
    <div class="parcours-card" data-id="${p.id}">
      <div class="parcours-body">
        <div class="card-name">${escape(p.name)}</div>
        ${p.address ? `<div class="card-address">${escape(p.address)}</div>` : ''}
        ${p.phone ? `<div><a href="tel:${escape(p.phone)}">${escape(p.phone)}</a></div>` : ''}

        <div class="parcours-status-row">
          <select class="status-select" data-id="${p.id}">
            <option value="todo" ${p.status === 'todo' ? 'selected' : ''}>À faire</option>
            <option value="visited" ${p.status === 'visited' ? 'selected' : ''}>Visité</option>
            <option value="interested" ${p.status === 'interested' ? 'selected' : ''}>Intéressé</option>
            <option value="not_interested" ${p.status === 'not_interested' ? 'selected' : ''}>Pas intéressé</option>
          </select>

          <button class="filter-btn toggle-tour-btn" data-id="${p.id}">
            ${p.in_tour ? 'Retirer tournée' : 'Ajouter tournée'}
          </button>

          ${mapsLink(p)}

          <button class="btn-delete" data-id="${p.id}">Supprimer</button>
        </div>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.status-select').forEach(el => {
    el.addEventListener('change', e => {
      updateProspect(e.target.dataset.id, { status: e.target.value });
    });
  });

  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => deleteParcours(e.target.dataset.id));
  });

  listEl.querySelectorAll('.toggle-tour-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.id;
      const item = allParcours.find(p => String(p.id) === String(id));
      updateProspect(id, { in_tour: item?.in_tour ? 0 : 1 });
    });
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