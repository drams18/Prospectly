if (!Auth.getToken()) window.location.href = 'login.html';

document.getElementById('usernameDisplay').textContent = Auth.getUsername() ?? '';
document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());

const statusEl = document.getElementById('status');
const listEl   = document.getElementById('parcoursList');
const startAddressInput = document.getElementById('startAddressInput');
const saveStartAddressBtn = document.getElementById('saveStartAddressBtn');

let allParcours    = [];
let currentFilter  = 'all';
const START_ADDRESS_KEY = 'prospectly_start_address';

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadParcours() {
  setStatus('Chargement...');

  try {
    const res = await fetch(`${API_URL}/parcours`, { headers: Auth.authHeaders() });
    if (res.status === 401) { Auth.logout(); return; }
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);

    const data = await res.json();
    allParcours = data.parcours ?? [];
    clearStatus();
    renderParcours();
  } catch (err) {
    setStatus(`Erreur : ${err.message}`, true);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderParcours() {
  const filtered = allParcours
    .filter((p) => {
      if (currentFilter === 'all') return true;
      if (currentFilter === 'tour') return p.in_tour === 1;
      return p.status === currentFilter;
    })
    .sort((a, b) => {
      if (currentFilter === 'tour') {
        const ao = a.tour_order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.tour_order ?? Number.MAX_SAFE_INTEGER;
        return ao - bo;
      }
      return 0;
    });

  if (!filtered.length) {
    listEl.innerHTML = '<p class="empty-state">Aucun prospect dans cette catégorie.</p>';
    return;
  }

  listEl.innerHTML = filtered.map(p => `
    <div class="parcours-card" data-id="${p.id}">
      <div class="score-badge ${scorePriority(p.score)}">${p.score ?? '?'}</div>
      <div class="parcours-body">
        <div class="card-name">${escape(p.name)}</div>
        ${p.address ? `<div class="card-address">${escape(p.address)}</div>` : ''}
        ${p.phone ? `<div class="parcours-phone"><a href="tel:${escape(p.phone)}">${escape(p.phone)}</a></div>` : ''}
        <div class="card-meta">
          <span class="tag ${p.in_tour ? 'platform' : 'has-site'}">${p.in_tour ? 'En tournee' : 'Hors tournee'}</span>
          <span class="tag ${visitTagClass(p.visit_status)}">${visitTagLabel(p.visit_status)}</span>
        </div>
        <div class="parcours-status-row">
          <select class="status-select" data-id="${p.id}">
            <option value="todo"           ${p.status === 'todo'           ? 'selected' : ''}>À faire</option>
            <option value="visited"        ${p.status === 'visited'        ? 'selected' : ''}>Visité</option>
            <option value="interested"     ${p.status === 'interested'     ? 'selected' : ''}>Intéressé</option>
            <option value="not_interested" ${p.status === 'not_interested' ? 'selected' : ''}>Pas intéressé</option>
          </select>
          <button class="filter-btn toggle-tour-btn" data-id="${p.id}">
            ${p.in_tour ? 'Retirer tournee' : 'Ajouter tournee'}
          </button>
          <button class="filter-btn visit-btn" data-id="${p.id}" data-visit="visited">Visite</button>
          <button class="filter-btn visit-btn" data-id="${p.id}" data-visit="absent">Absent</button>
          ${mapsLink(p)}
          <button class="btn-delete" data-id="${p.id}">Supprimer</button>
        </div>
        <div class="parcours-status-row">
          <input class="tour-order-input" type="number" min="1" value="${p.tour_order ?? ''}" placeholder="Ordre" data-id="${p.id}" />
          <input class="note-input" type="text" value="${escapeAttr(p.notes ?? '')}" placeholder="Note rapide..." data-id="${p.id}" />
          <button class="filter-btn save-note-btn" data-id="${p.id}">Sauver note</button>
        </div>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', e => updateStatus(e.target.dataset.id, e.target.value));
  });

  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => deleteParcours(e.target.dataset.id));
  });
  listEl.querySelectorAll('.toggle-tour-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const item = allParcours.find((p) => String(p.id) === String(id));
      updateProspect(id, { in_tour: item?.in_tour ? 0 : 1 });
    });
  });
  listEl.querySelectorAll('.visit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => updateProspect(e.target.dataset.id, { visit_status: e.target.dataset.visit }));
  });
  listEl.querySelectorAll('.save-note-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const noteInput = listEl.querySelector(`.note-input[data-id="${id}"]`);
      const orderInput = listEl.querySelector(`.tour-order-input[data-id="${id}"]`);
      const nextOrder = Number(orderInput?.value || 0);
      updateProspect(id, {
        notes: noteInput?.value ?? '',
        tour_order: nextOrder > 0 ? nextOrder : null,
      });
    });
  });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function updateStatus(id, status) {
  await updateProspect(id, { status });
}

async function updateProspect(id, payload) {
  try {
    const res = await fetch(`${API_URL}/parcours/${id}`, {
      method: 'PATCH',
      headers: Auth.authHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) { Auth.logout(); return; }
    if (!res.ok) throw new Error('Erreur de mise a jour');
    const item = allParcours.find(p => p.id == id);
    if (item) Object.assign(item, payload);
    renderParcours();
  } catch (err) {
    setStatus(`Erreur : ${err.message}`, true);
  }
}

async function deleteParcours(id) {
  if (!confirm('Supprimer ce prospect du parcours ?')) return;

  try {
    const res = await fetch(`${API_URL}/parcours/${id}`, {
      method: 'DELETE',
      headers: Auth.authHeaders(),
    });
    if (res.status === 401) { Auth.logout(); return; }
    allParcours = allParcours.filter(p => p.id != id);
    renderParcours();
  } catch (err) {
    console.error('[Parcours] deleteParcours error:', err.message);
  }
}

// ─── Filter buttons ───────────────────────────────────────────────────────────

document.querySelectorAll('#parcoursFilters .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#parcoursFilters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.status;
    renderParcours();
  });
});

saveStartAddressBtn?.addEventListener('click', () => {
  localStorage.setItem(START_ADDRESS_KEY, startAddressInput.value.trim());
  setStatus('Adresse de depart enregistree');
  setTimeout(clearStatus, 1000);
});

// ─── Utils ────────────────────────────────────────────────────────────────────

function scorePriority(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return escape(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function visitTagClass(status) {
  if (status === 'visited') return 'has-site';
  if (status === 'absent') return 'bad-site';
  return 'reviews';
}

function visitTagLabel(status) {
  if (status === 'visited') return 'Visite';
  if (status === 'absent') return 'Absent';
  return 'En attente';
}

function mapsLink(item) {
  if (!item.address) return '';
  const origin = encodeURIComponent(localStorage.getItem(START_ADDRESS_KEY) || '');
  const destination = encodeURIComponent(item.address);
  const href = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
    : `https://www.google.com/maps/search/?api=1&query=${destination}`;
  return `<a class="filter-btn" href="${href}" target="_blank" rel="noopener">Maps</a>`;
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden', 'error');
  if (isError) statusEl.classList.add('error');
}

function clearStatus() {
  statusEl.classList.add('hidden');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

startAddressInput.value = localStorage.getItem(START_ADDRESS_KEY) || '';
loadParcours();
