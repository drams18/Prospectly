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

function renderParcours() {
  let filtered;
  
  if (currentFilter === 'all') {
    filtered = allParcours;
  } else if (currentFilter === 'favorites') {
    filtered = allParcours.filter(p => p.is_favorite === 1 || p.is_favorite === true);
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
    const isFavorite = p.is_favorite === 1 || p.is_favorite === true;
    const distance = calculateDistance(p);
    
    return `
    <div class="parcours-card ${statusClass}${isFavorite ? ' favorite' : ''}" data-id="${p.id}">
      <div class="parcours-body">
        <div class="card-header">
          <div class="card-name">${escape(p.name)}</div>
          <button class="btn-favorite ${isFavorite ? 'active' : ''}" data-id="${p.id}" title="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
            ⭐
          </button>
        </div>
        ${p.address ? `<div class="card-address">${escape(p.address)}</div>` : ''}
        ${distance !== null ? `<div class="card-distance">📍 ${formatDistance(distance)}</div>` : ''}
        ${p.phone ? `<div><a href="tel:${escape(p.phone)}">${escape(p.phone)}</a></div>` : ''}

        <div class="parcours-status-row">
          <select class="status-select" data-id="${p.id}">
            <option value="not_done" ${p.status === 'not_done' ? 'selected' : ''}>Non fait</option>
            <option value="done" ${p.status === 'done' ? 'selected' : ''}>Fait</option>
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

  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => deleteParcours(e.target.dataset.id));
  });
}

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
  return String(str ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
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