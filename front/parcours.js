if (!Auth.getToken()) window.location.href = 'login.html';

document.getElementById('usernameDisplay').textContent = Auth.getUsername() ?? '';
document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());

const statusEl = document.getElementById('status');
const listEl   = document.getElementById('parcoursList');

let allParcours    = [];
let currentFilter  = 'all';

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
  const filtered = currentFilter === 'all'
    ? allParcours
    : allParcours.filter(p => p.status === currentFilter);

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
        <div class="parcours-status-row">
          <select class="status-select" data-id="${p.id}">
            <option value="todo"           ${p.status === 'todo'           ? 'selected' : ''}>À faire</option>
            <option value="visited"        ${p.status === 'visited'        ? 'selected' : ''}>Visité</option>
            <option value="interested"     ${p.status === 'interested'     ? 'selected' : ''}>Intéressé</option>
            <option value="not_interested" ${p.status === 'not_interested' ? 'selected' : ''}>Pas intéressé</option>
          </select>
          <button class="btn-delete" data-id="${p.id}">Supprimer</button>
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
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function updateStatus(id, status) {
  try {
    const res = await fetch(`${API_URL}/parcours/${id}`, {
      method: 'PATCH',
      headers: Auth.authHeaders(),
      body: JSON.stringify({ status }),
    });
    if (res.status === 401) { Auth.logout(); return; }
    const item = allParcours.find(p => p.id == id);
    if (item) item.status = status;
  } catch (err) {
    console.error('[Parcours] updateStatus error:', err.message);
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

// ─── Utils ────────────────────────────────────────────────────────────────────

function scorePriority(score) {
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

loadParcours();
