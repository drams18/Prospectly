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

let allParcours = [];
let currentFilter = 'all';
let user = null;
let userAddress = null; // Store user's address for distance calculation
let currentDetailProspect = null; // Track currently open detail modal

// ─── Pipeline status labels and colors ─────────────────────────────────────────

const PIPELINE_LABELS = {
  new: 'Nouveau',
  contacted: 'Contacté',
  interested: 'Intéressé',
  converted: 'Converti',
  refused: 'Refusé'
};

// ─── User ID helper ────────────────────────────────────────────────────────────

function getUserId() {
  const token = Auth.getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch {
    return null;
  }
}

// ─── Load user data ────────────────────────────────────────────────────────────

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
  userAddress = user.start_address ?? null;
}

// ─── Load parcours ─────────────────────────────────────────────────────────────

async function loadParcours() {
  setStatus('Chargement...');

  try {
    // Pass user_address to get parcours sorted by distance
    const url = userAddress 
      ? `${API_URL}/parcours?user_address=${encodeURIComponent(userAddress)}`
      : `${API_URL}/parcours`;
      
    const res = await fetch(url, {
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

// ─── Render parcours list ──────────────────────────────────────────────────────

function renderParcours() {
  let filtered;
  
  if (currentFilter === 'all') {
    filtered = allParcours;
  } else if (currentFilter === 'favorites') {
    filtered = allParcours.filter(p => p.is_favorite === 1 || p.is_favorite === true);
  } else if (currentFilter === 'pipeline') {
    // Filter by pipeline status
    filtered = allParcours.filter(p => p.pipeline_status === currentFilter);
  } else {
    filtered = allParcours.filter(p => p.status === currentFilter);
  }

  // Sort by distance if coordinates are available
  if (userAddress && filtered.length > 0) {
    filtered.sort((a, b) => {
      const distA = calculateDistance(a);
      const distB = calculateDistance(b);
      if (distA === null) return 1;
      if (distB === null) return -1;
      return distA - distB;
    });
  }

  if (!filtered.length) {
    if (currentFilter === 'favorites') {
      listEl.innerHTML = '<p class="empty-state">Aucun favori. Cliquez sur ⭐ pour ajouter des favoris.</p>';
    } else {
      listEl.innerHTML = '<p class="empty-state">Aucun prospect dans cette catégorie.</p>';
    }
    return;
  }

  listEl.innerHTML = filtered.map(p => {
    // Determine status class for card styling
    const statusClass = p.status === 'done' ? 'status-done' : 'status-not-done';
    const pipelineClass = p.pipeline_status ? `pipeline-${p.pipeline_status}` : 'pipeline-new';
    const isFavorite = p.is_favorite === 1 || p.is_favorite === true;
    const distance = calculateDistance(p);
    const pipelineStatus = p.pipeline_status || 'new';
    
    return `
    <div class="parcours-card ${statusClass} ${pipelineClass}${isFavorite ? ' favorite' : ''}" data-id="${p.id}">
      <div class="parcours-body">
        <div class="card-header">
          <div class="card-name">${escape(p.name)}</div>
          <button class="btn-favorite ${isFavorite ? 'active' : ''}" data-id="${p.id}" title="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
            ⭐
          </button>
        </div>
        ${p.address ? `<div class="card-address">${escape(p.address)}</div>` : ''}
        ${distance !== null ? `<div class="card-distance">📍 ${formatDistance(distance)}</div>` : ''}
        ${p.phone ? `<div class="parcours-phone"><a href="tel:${escape(p.phone)}">${escape(p.phone)}</a></div>` : ''}

        <div class="parcours-status-row">
          <span class="pipeline-badge ${pipelineStatus}">${PIPELINE_LABELS[pipelineStatus] || pipelineStatus}</span>
          
          <select class="pipeline-select" data-id="${p.id}" title="Changer le statut pipeline">
            <option value="new" ${pipelineStatus === 'new' ? 'selected' : ''}>Nouveau</option>
            <option value="contacted" ${pipelineStatus === 'contacted' ? 'selected' : ''}>Contacté</option>
            <option value="interested" ${pipelineStatus === 'interested' ? 'selected' : ''}>Intéressé</option>
            <option value="converted" ${pipelineStatus === 'converted' ? 'selected' : ''}>Converti</option>
            <option value="refused" ${pipelineStatus === 'refused' ? 'selected' : ''}>Refusé</option>
          </select>

          <button class="btn-detail" data-id="${p.id}" title="Voir les détails">📋</button>
          <button class="btn-delete" data-id="${p.id}">Supprimer</button>
        </div>
      </div>
    </div>
  `}).join('');

  // Pipeline status change handler
  listEl.querySelectorAll('.pipeline-select').forEach(el => {
    el.addEventListener('change', e => {
      updatePipelineStatus(e.target.dataset.id, e.target.value);
    });
  });

  // Favorite handler
  listEl.querySelectorAll('.btn-favorite').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      const prospect = allParcours.find(p => p.id == id);
      if (prospect) {
        const newFavorite = !(prospect.is_favorite === 1 || prospect.is_favorite === true);
        updateProspect(id, { is_favorite: newFavorite });
      }
    });
  });

  // Detail button handler
  listEl.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      openProspectDetail(id);
    });
  });

  // Delete handler
  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => deleteParcours(e.target.dataset.id));
  });
}

// ─── Calculate distance ────────────────────────────────────────────────────────

function calculateDistance(prospect) {
  // If prospect has lat/lng stored, calculate distance from user address
  if (prospect.lat && prospect.lng && userAddress) {
    // We need to geocode user address to get coordinates
    // For now, return null if we don't have user coordinates cached
    // The backend handles this when user_address is provided
    return null;
  }
  return null;
}

// ─── Update prospect ───────────────────────────────────────────────────────────

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
    if (item) {
      Object.assign(item, payload);
      // Update is_favorite as integer for consistency
      if (payload.is_favorite !== undefined) {
        item.is_favorite = payload.is_favorite ? 1 : 0;
      }
    }

    renderParcours();
  } catch (err) {
    setStatus(err.message, true);
  }
}

// ─── Update pipeline status ────────────────────────────────────────────────────

async function updatePipelineStatus(id, pipelineStatus) {
  try {
    const res = await fetch(`${API_URL}/parcours/${id}/status`, {
      method: 'PATCH',
      headers: Auth.authHeaders(),
      body: JSON.stringify({ pipeline_status: pipelineStatus }),
    });

    if (res.status === 401) Auth.logout();
    if (!res.ok) {
      let error;
try {
  error = await res.json();
} catch {
  error = { error: 'Erreur serveur inconnue' };
}
      throw new Error(error.error || 'Erreur mise à jour statut');
    }

    // Update local data
    const item = allParcours.find(p => p.id == id);
    if (item) {
      item.pipeline_status = pipelineStatus;
    }

    // Refresh the list to show updated styling
    renderParcours();
    
    // If detail modal is open for this prospect, refresh it
    if (currentDetailProspect && currentDetailProspect.id == id) {
      currentDetailProspect.pipeline_status = pipelineStatus;
      updateDetailPipelineBadge();
    }
  } catch (err) {
    setStatus(err.message, true);
    // Revert the select on error
    const select = listEl.querySelector(`.pipeline-select[data-id="${id}"]`);
    if (select) {
      const item = allParcours.find(p => p.id == id);
      if (item) {
        select.value = item.pipeline_status || 'new';
      }
    }
  }
}

// ─── Delete parcours ───────────────────────────────────────────────────────────

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
    
    // Close detail modal if open
    if (currentDetailProspect && currentDetailProspect.id == id) {
      closeProspectDetail();
    }
  } catch (err) {
    setStatus(err.message, true);
  }
}

// ─── Open prospect detail modal ────────────────────────────────────────────────

async function openProspectDetail(id) {
  const prospect = allParcours.find(p => p.id == id);
  if (!prospect) return;

  currentDetailProspect = prospect;

  // Fetch actions for this prospect
  let actions = [];
  try {
    const res = await fetch(`${API_URL}/actions/${id}`, {
      headers: Auth.authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      actions = data.actions || [];
    }
  } catch (err) {
    console.error('[openProspectDetail] Error fetching actions:', err);
  }

  const pipelineStatus = prospect.pipeline_status || 'new';

  const modalHtml = `
    <div class="prospect-detail-modal" id="prospectDetailModal">
      <div class="prospect-detail-backdrop" onclick="closeProspectDetail()"></div>
      <div class="prospect-detail-content">
        <div class="prospect-detail-header">
          <div>
            <h2 class="prospect-detail-name">${escape(prospect.name)}</h2>
            ${prospect.address ? `<div class="prospect-detail-address">${escape(prospect.address)}</div>` : ''}
          </div>
          <button class="prospect-detail-close" onclick="closeProspectDetail()" title="Fermer">×</button>
        </div>

        <div class="prospect-detail-info">
          ${prospect.phone ? `
            <div class="prospect-detail-field">
              <span class="prospect-detail-label">Téléphone</span>
              <span class="prospect-detail-value"><a href="tel:${escape(prospect.phone)}">${escape(prospect.phone)}</a></span>
            </div>
          ` : ''}
          ${prospect.website ? `
            <div class="prospect-detail-field">
              <span class="prospect-detail-label">Site web</span>
              <span class="prospect-detail-value"><a href="${escape(prospect.website)}" target="_blank">${escape(prospect.website)}</a></span>
            </div>
          ` : ''}
          ${prospect.rating !== undefined ? `
            <div class="prospect-detail-field">
              <span class="prospect-detail-label">Note</span>
              <span class="prospect-detail-value">⭐ ${prospect.rating}/5 (${prospect.reviews || 0} avis)</span>
            </div>
          ` : ''}
          ${prospect.score !== undefined ? `
            <div class="prospect-detail-field">
              <span class="prospect-detail-label">Score</span>
              <span class="prospect-detail-value">${prospect.score}/100</span>
            </div>
          ` : ''}
          <div class="prospect-detail-field">
            <span class="prospect-detail-label">Statut</span>
            <span class="prospect-detail-value" id="detailPipelineBadge">
              <span class="pipeline-badge ${pipelineStatus}">${PIPELINE_LABELS[pipelineStatus] || pipelineStatus}</span>
            </span>
          </div>
        </div>

        <div class="parcours-status-row" style="margin-bottom: 16px;">
          <select class="pipeline-select" id="detailPipelineSelect" data-id="${prospect.id}" onchange="updateDetailPipelineFromSelect(this)">
            <option value="new" ${pipelineStatus === 'new' ? 'selected' : ''}>Nouveau</option>
            <option value="contacted" ${pipelineStatus === 'contacted' ? 'selected' : ''}>Contacté</option>
            <option value="interested" ${pipelineStatus === 'interested' ? 'selected' : ''}>Intéressé</option>
            <option value="converted" ${pipelineStatus === 'converted' ? 'selected' : ''}>Converti</option>
            <option value="refused" ${pipelineStatus === 'refused' ? 'selected' : ''}>Refusé</option>
          </select>
          ${prospect.google_maps_url || prospect.address ? `
            <a class="filter-btn" href="${escape(prospect.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prospect.address)}`)}" target="_blank" rel="noopener">🗺️ Maps</a>
          ` : ''}
        </div>

        <div class="action-history">
          <div class="action-history-title">Historique des actions</div>
          <div class="action-list" id="actionList">
            ${actions.length === 0 
              ? '<div class="action-empty">Aucune action enregistrée</div>'
              : actions.map(action => `
                  <div class="action-item">
                    <span class="action-type ${action.type}">${getActionTypeLabel(action.type)}</span>
                    <span class="action-content">${escape(action.content || '')}</span>
                    <span class="action-time">${formatActionTime(action.created_at)}</span>
                  </div>
                `).join('')
            }
          </div>
        </div>

        <div class="add-action-form">
          <select id="actionTypeSelect">
            <option value="call">📞 Appel</option>
            <option value="sms">📱 SMS</option>
            <option value="visit">🏢 Visite</option>
            <option value="note">📝 Note</option>
          </select>
          <input type="text" id="actionContentInput" placeholder="Description..." onkeypress="if(event.key==='Enter')addAction()" />
          <button class="btn-add-action" onclick="addAction()">Ajouter</button>
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if any
  const existingModal = document.getElementById('prospectDetailModal');
  if (existingModal) {
    existingModal.remove();
  }

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ─── Close prospect detail modal ───────────────────────────────────────────────

function closeProspectDetail() {
  currentDetailProspect = null;
  const modal = document.getElementById('prospectDetailModal');
  if (modal) {
    modal.remove();
  }
}

// ─── Update detail pipeline badge ──────────────────────────────────────────────

function updateDetailPipelineBadge() {
  const badgeEl = document.getElementById('detailPipelineBadge');
  if (badgeEl && currentDetailProspect) {
    const status = currentDetailProspect.pipeline_status || 'new';
    badgeEl.innerHTML = `<span class="pipeline-badge ${status}">${PIPELINE_LABELS[status] || status}</span>`;
  }
}

// ─── Update pipeline from detail select ────────────────────────────────────────

async function updateDetailPipelineFromSelect(selectEl) {
  if (!currentDetailProspect) return;
  await updatePipelineStatus(currentDetailProspect.id, selectEl.value);
}

// ─── Add action ────────────────────────────────────────────────────────────────

async function addAction() {
  if (!currentDetailProspect) return;

  const typeSelect = document.getElementById('actionTypeSelect');
  const contentInput = document.getElementById('actionContentInput');
  
  const type = typeSelect.value;
  const content = contentInput.value.trim();

  if (!content) {
    setStatus('Veuillez entrer une description', true);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/actions`, {
      method: 'POST',
      headers: Auth.authHeaders(),
      body: JSON.stringify({
        prospect_id: parseInt(currentDetailProspect.id),
        type,
        content
      }),
    });

    if (res.status === 401) Auth.logout();
    if (!res.ok) {
      let error;
try {
  error = await res.json();
} catch {
  error = { error: 'Erreur serveur inconnue' };
}
      throw new Error(error.error || 'Erreur ajout action');
    }

    // Clear input
    contentInput.value = '';

    // Refresh actions list
    refreshActions();
  } catch (err) {
    setStatus(err.message, true);
  }
}

// ─── Refresh actions list ──────────────────────────────────────────────────────

async function refreshActions() {
  if (!currentDetailProspect) return;

  try {
    const res = await fetch(`${API_URL}/actions/${currentDetailProspect.id}`, {
      headers: Auth.authHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      const actions = data.actions || [];

      const actionListEl = document.getElementById('actionList');
      if (actionListEl) {
        actionListEl.innerHTML = actions.length === 0
          ? '<div class="action-empty">Aucune action enregistrée</div>'
          : actions.map(action => `
              <div class="action-item">
                <span class="action-type ${action.type}">${getActionTypeLabel(action.type)}</span>
                <span class="action-content">${escape(action.content || '')}</span>
                <span class="action-time">${formatActionTime(action.created_at)}</span>
              </div>
            `).join('');
      }
    }
  } catch (err) {
    console.error('[refreshActions] Error:', err);
  }
}

// ─── Get action type label ─────────────────────────────────────────────────────

function getActionTypeLabel(type) {
  const labels = {
    call: '📞 Appel',
    sms: '📱 SMS',
    visit: '🏢 Visite',
    note: '📝 Note',
    status_change: '🔄 Statut'
  };
  return labels[type] || type;
}

// ─── Format action time ────────────────────────────────────────────────────────

function formatActionTime(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch {
    return dateStr;
  }
}

// ─── Filter handlers ───────────────────────────────────────────────────────────

document.querySelectorAll('#parcoursFilters .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#parcoursFilters .filter-btn')
      .forEach(b => b.classList.remove('active'));

    btn.classList.add('active');
    currentFilter = btn.dataset.status;
    renderParcours();
  });
});

// ─── Helper functions ──────────────────────────────────────────────────────────

function mapsLink(item) {
  if (!item.address) return '';

  const origin = encodeURIComponent(user?.start_address || '');
  const destination = encodeURIComponent(item.address);

  const href = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
    : `https://www.google.com/maps/search/?api=1&query=${destination}`;

  return `<a class="filter-btn" href="${href}" target="_blank" rel="noopener">Maps</a>`;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function escape(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function setStatus(msg, error = false) {
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden', 'error');
  if (error) statusEl.classList.add('error');
}

function clearStatus() {
  statusEl.classList.add('hidden');
}

// ─── Initialize ────────────────────────────────────────────────────────────────

async function init() {
  await loadUser();
  await loadParcours();
}

init();