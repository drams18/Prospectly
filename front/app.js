// ─── Auth Guard — wrapped in DOMContentLoaded to prevent early execution ──────
// IMPORTANT: This MUST be inside DOMContentLoaded to avoid execution before DOM ready
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

// Auth bar setup will be done inside DOMContentLoaded above

const locationInput    = document.getElementById('locationInput');
const searchBtn        = document.getElementById('searchBtn');
const searchForm       = document.getElementById('searchForm');
const queryInput = document.getElementById('queryInput');
const arrondissementSuggestions = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  return `750${String(n).padStart(2, '0')} Paris ${n}${n === 1 ? 'er' : 'e'}`;
});
const districtSuggestions = [
  'Bastille', 'Republique', 'Opera', 'Le Marais', 'Montmartre', 'Belleville', 'Nation', 'Batignolles',
];

const statusEl      = document.getElementById('status');
const toolbarEl     = document.getElementById('toolbar');
const resultCountEl = document.getElementById('resultCount');
const resultsEl     = document.getElementById('results');
const detailPanel   = document.getElementById('detailPanel');

const mobileOverlay         = document.getElementById('mobileOverlay');
const mobileOverlayContent  = document.getElementById('mobileOverlayContent');
const mobileOverlayClose    = document.getElementById('mobileOverlayClose');
const mobileOverlayBackdrop = document.getElementById('mobileOverlayBackdrop');
const filterNoWebsite = document.getElementById('filterNoWebsite');
const filterMinRating = document.getElementById('filterMinRating');
const filterCategory = document.getElementById('filterCategory');
const filterMinScore = document.getElementById('filterMinScore');

function isMobile() {
  return window.innerWidth <= 640;
}

function openMobileOverlay(html) {
  mobileOverlayContent.innerHTML = html;
  mobileOverlay.setAttribute('aria-hidden', 'false');
  mobileOverlay.classList.add('open');
  mobileOverlayBackdrop.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeMobileOverlay() {
  mobileOverlay.classList.remove('open');
  mobileOverlayBackdrop.classList.remove('visible');
  mobileOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

mobileOverlayClose.addEventListener('click', closeMobileOverlay);
mobileOverlayBackdrop.addEventListener('click', closeMobileOverlay);

let currentResults   = [];
let displayedResults = [];
let selectedIndex    = null;
let isSearching      = false;
let searchLat        = null;
let searchLng        = null;
let acDebounce       = null;
let parcoursSet      = new Set();
let seenSet          = new Set();
let searchHistory    = [];
let userAddress      = null; // User's stored address from database

const QUICK_SMS_SCRIPT = (prospect = {}) => {
  const name = prospect.name || "votre établissement";
  const type = (prospect.types || []).join(' ').toLowerCase();

  let label = "commerces";
  if (type.includes('hair') || type.includes('beauty')) label = "salons";
  else if (type.includes('restaurant') || type.includes('food')) label = "restaurants";
  else if (type.includes('gym') || type.includes('fitness')) label = "salles de sport";
  else if (type.includes('car') || type.includes('garage')) label = "garages";

  return `Bonjour, je vous contacte car j'aide des ${label} comme ${name} à obtenir plus de clients via Google et à automatiser les réservations. Est-ce que vous avez déjà un site optimisé aujourd'hui ?`;
};

const QUICK_CALL_SCRIPT = (prospect = {}) => {
  const name = prospect.name || "votre établissement";
  const type = (prospect.types || []).join(' ').toLowerCase();

  let label = "commerces";
  if (type.includes('hair') || type.includes('beauty')) label = "salons";
  else if (type.includes('restaurant') || type.includes('food')) label = "restaurants";
  else if (type.includes('gym') || type.includes('fitness')) label = "salles de sport";
  else if (type.includes('car') || type.includes('garage')) label = "garages";

  return `Bonjour, je travaille avec des ${label} comme ${name} pour leur apporter plus de clients via Google et simplifier les réservations. Je voulais savoir si vous avez déjà un site performant aujourd'hui ?`;
};

const FALLBACK_PLACE_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <rect width="800" height="450" fill="#f1f5f9"/>
    <circle cx="400" cy="185" r="36" fill="#94a3b8"/>
    <rect x="280" y="260" width="240" height="16" rx="8" fill="#94a3b8"/>
    <rect x="320" y="286" width="160" height="12" rx="6" fill="#cbd5e1"/>
  </svg>`
);

// ─── Parcours set (in-memory, loaded at startup) ──────────────────────────────

async function loadParcoursSet() {
  try {
    const res = await fetch(`${API_URL}/parcours`, { headers: Auth.authHeaders() });
    if (!res.ok) return;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return;
    const data = await res.json();
    parcoursSet = new Set((data.parcours || []).map(p => `${p.name}||${p.address}`));
  } catch {}
}

// ─── Seen prospects (database) ────────────────────────────────────────────────

async function loadSeen() {
  try {
    const res = await fetch(`${API_URL}/seen`, { headers: Auth.authHeaders() });
    if (!res.ok) return new Set();
    const data = await res.json();
    seenSet = new Set((data.seen || []).map(s => `${s.name}||${s.address}`));
  } catch {
    seenSet = new Set();
  }
}

async function markSeen(s) {
  const key = seenKey(s);
  if (seenSet.has(key)) return;
  
  try {
    await fetch(`${API_URL}/seen`, {
      method: 'POST',
      headers: Auth.authHeaders(),
      body: JSON.stringify({ name: s.name, address: s.address }),
    });
    seenSet.add(key);
  } catch {}
}

// ─── Search history (database) ────────────────────────────────────────────────

async function loadHistory() {
  try {
    const res = await fetch(`${API_URL}/history?limit=10`, { headers: Auth.authHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    searchHistory = (data.history || []).map(h => h.location);
  } catch {
    searchHistory = [];
  }
}

async function addToHistory(location) {
  try {
    await fetch(`${API_URL}/history`, {
      method: 'POST',
      headers: Auth.authHeaders(),
      body: JSON.stringify({ location }),
    });
    // Update local cache
    searchHistory = searchHistory.filter(h => h !== location);
    searchHistory.unshift(location);
    searchHistory = searchHistory.slice(0, 10);
  } catch {}
}

async function removeFromHistory(location) {
  try {
    await fetch(`${API_URL}/history/${encodeURIComponent(location)}`, {
      method: 'DELETE',
      headers: Auth.authHeaders(),
    });
    searchHistory = searchHistory.filter(h => h !== location);
  } catch {}
}

// ─── Load user data ───────────────────────────────────────────────────────────

async function loadUser() {
  try {
    const res = await fetch(`${API_URL}/me`, { headers: Auth.authHeaders() });
    
    // Handle 401 - token invalide ou expiré
    if (res.status === 401) {
      Auth.logout();
      return;
    }
    
    if (!res.ok) return;
    
    // Vérifier que la réponse est du JSON
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return;
    }
    
    const user = await res.json();
    userAddress = user.start_address ?? null;
  } catch {
    // En cas d'erreur réseau ou autre, on continue silencieusement
  }
}

// ─── Initialize data from database ────────────────────────────────────────────

async function initializeData() {
  await loadUser();
  await loadParcoursSet();
  await loadSeen();
  await loadHistory();
}

initializeData();

// ─── Search ───────────────────────────────────────────────────────────────────

function updateSearchButtonState() {
  const location = locationInput.value.trim();
  searchBtn.disabled = isSearching || location === '';
}

async function search() {
  const location = locationInput.value.trim();
  const businessType = queryInput.value.trim();
  if (!location || isSearching) return;

  isSearching = true;
  setStatus('Recherche en cours…');
  updateSearchButtonState();
  resultsEl.innerHTML = '';
  detailPanel.classList.add('hidden');
  closeMobileOverlay();
  selectedIndex = null;
  displayedResults = [];
  currentResults = [];
  toolbarEl.classList.add('hidden');

  try {
    const body = { location, mode: 'single', businessType };
    if (searchLat != null && searchLng != null) {
      body.lat = searchLat;
      body.lng = searchLng;
    }

    const res = await fetch(`${API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 401) { Auth.logout(); return; }
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);

    const data = await res.json();
    currentResults = Array.isArray(data) ? data : (data.results ?? []);
    await addToHistory(location);
    renderResults();
    clearStatus();
  } catch (err) {
    console.error('[Prospectly] Erreur API /search :', err);
    setStatus(`Erreur : ${err.message}`, true);
  } finally {
    isSearching = false;
    updateSearchButtonState();
  }
}

function handleSearch(event) {
  if (event) event.preventDefault();
  search();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderResults() {
  if (!currentResults.length) {
    setStatus('Aucun résultat trouvé.');
    return;
  }

  displayedResults = applyFilters(currentResults);
  if (!displayedResults.length) {
    resultCountEl.textContent = '0 prospect trouve';
    toolbarEl.classList.remove('hidden');
    resultsEl.innerHTML = '<p class="empty-state">Aucun prospect avec ces filtres.</p>';
    return;
  }

  resultCountEl.textContent = `${displayedResults.length} prospect${displayedResults.length > 1 ? 's' : ''} trouve${displayedResults.length > 1 ? 's' : ''}`;
  toolbarEl.classList.remove('hidden');

  const cards = displayedResults.map((s, i) => {
    const isSeen = seenSet.has(seenKey(s));
    const imageUrl = escape(s.imageUrl || FALLBACK_PLACE_IMAGE);
    const actionLabel = 'Voir details';
    return `
      <div class="card${isSeen ? ' seen' : ''}" data-index="${i}">
        <div class="card-cover loading">
          <img class="card-image" src="${imageUrl}" alt="${escape(s.name)}" loading="lazy" decoding="async" />
          <div class="card-cover-gradient"></div>
          <div class="card-cover-content">
            <div class="score-badge ${scorePriority(s.score)}">${s.score}</div>
            <div class="card-cover-title">${escape(s.name)}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-status-line">
            <span class="tag score-label ${s.scoreLabel || 'low'}">${scoreLabelText(s.scoreLabel)}</span>
            <span class="tag web-health ${siteHealthClass(s)}">${siteHealthText(s)}</span>
          </div>
          <div class="card-address">${escape(s.address)}</div>
          <div class="card-meta">
            ${isSeen ? '<span class="badge-seen">Déjà vue</span>' : ''}
            ${webTag(s)}
            ${s.rating ? `<span class="tag rating">★ ${s.rating}</span>` : ''}
            ${s.reviews ? `<span class="tag reviews">${s.reviews} avis</span>` : ''}
            ${s.distance != null ? `<span class="tag distance">${formatDistance(s.distance)}</span>` : ''}
          </div>
          <div class="card-actions">
            ${s.phone ? `<a class="quick-btn" href="tel:${escape(s.phone)}">Appeler</a>` : ''}
            <button class="quick-btn secondary" data-quick="copy-phone" data-index="${i}">Copier numéro</button>
            <button class="quick-btn secondary" data-quick="copy-msg" data-index="${i}">Copier message</button>
            <a class="quick-btn secondary" href="${escape(s.googleMapsUrl)}" target="_blank" rel="noopener">Maps</a>
          </div>
        </div>
        <button class="detail-btn" title="${actionLabel}">${actionLabel}</button>
      </div>
    `;
  }).join('');

  resultsEl.innerHTML = cards;
  resultsEl.querySelectorAll('.card-image').forEach((img) => {
    const cover = img.closest('.card-cover');
    if (!cover) return;

    const onLoad = () => {
      cover.classList.remove('loading');
      cover.classList.add('loaded');
    };

    const onError = () => {
      if (!img.dataset.fallbackApplied) {
        img.dataset.fallbackApplied = '1';
        img.src = FALLBACK_PLACE_IMAGE;
        return;
      }
      onLoad();
    };

    if (img.complete && img.naturalWidth > 0) onLoad();
    else {
      img.addEventListener('load', onLoad, { once: true });
      img.addEventListener('error', onError, { once: true });
    }
  });

  resultsEl.addEventListener('click', handleCardClick, { once: false });
}

function handleCardClick(e) {
  const quickTarget = e.target.closest('[data-quick]');
  if (quickTarget) {
    const idx = parseInt(quickTarget.dataset.index, 10);
    const prospect = displayedResults[idx];
    if (!prospect) return;
    if (quickTarget.dataset.quick === 'copy-phone') {
      copyToClipboard(prospect.phone || '');
      return;
    }
    if (quickTarget.dataset.quick === 'copy-msg') {
      copyToClipboard(buildSmsMessage(prospect));
      return;
    }
  }
  const card = e.target.closest('.card');
  if (!card) return;
  const index = parseInt(card.dataset.index, 10);
  selectProspect(index);
}

function selectProspect(index) {
  selectedIndex = index;
  const prospect = displayedResults[index];

  markSeen(prospect);

  resultsEl.querySelectorAll('.card').forEach((card) => {
    const cardIndex = parseInt(card.dataset.index, 10);
    const isSelected = cardIndex === index;
    card.classList.toggle('selected', isSelected);

    if (isSelected) {
      card.classList.add('seen');
      if (!card.querySelector('.badge-seen')) {
        const meta = card.querySelector('.card-meta');
        if (meta) {
          const badge = document.createElement('span');
          badge.className = 'badge-seen';
          badge.textContent = 'Déjà vue';
          meta.insertBefore(badge, meta.firstChild);
        }
      }
    }
  });

  renderDetail(prospect);
}

function renderDetail(s) {
  const phone   = s.phone   ?? null;
  const website = s.website ?? null;
  const notFound = '<span class="not-found">information non trouvée</span>';

  const phoneHtml = phone
    ? `<a href="tel:${escape(phone)}">${escape(phone)}</a>`
    : notFound;

  const html = `
    <div class="detail-header">
      <div class="score-badge ${scorePriority(s.score)} detail-score">${s.score}</div>
      <div class="detail-title-block">
        <div class="detail-name">${escape(s.name)}</div>
        <div class="detail-score-label">Score de prospection</div>
      </div>
    </div>

    <div class="detail-fields">
      <div class="detail-field">
        <div class="detail-label">Nom</div>
        <div class="detail-value">${escape(s.name) || notFound}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">Adresse</div>
        <div class="detail-value">${escape(s.address) || notFound}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">Téléphone</div>
        <div class="detail-value">${phoneHtml}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">Site web</div>
        <div class="detail-value">${website
          ? `<a href="${escape(website)}" target="_blank" rel="noopener">${escape(website)}</a>`
          : notFound
        }</div>
      </div>
      ${s.distance != null ? `
      <div class="detail-field">
        <div class="detail-label">Distance</div>
        <div class="detail-value">${formatDistance(s.distance)}</div>
      </div>` : ''}
    </div>

    <div class="detail-meta">
      ${webTag(s)}
      <span class="tag web-health ${siteHealthClass(s)}">${siteHealthText(s)}</span>
      ${s.rating  ? `<span class="tag rating">★ ${s.rating}</span>`     : ''}
      ${s.reviews ? `<span class="tag reviews">${s.reviews} avis</span>` : ''}
      ${s.distance != null ? `<span class="tag distance">${formatDistance(s.distance)}</span>` : ''}
    </div>

    <div class="detail-actions">
      ${phone ? `<a class="quick-btn" href="tel:${escape(phone)}">Appeler</a>` : ''}
      <button class="quick-btn secondary" id="copyPhoneBtn">Copier numéro</button>
      <button class="quick-btn secondary" id="copySmsBtn">Copier message</button>
      <a class="quick-btn secondary" href="${escape(s.googleMapsUrl)}" target="_blank" rel="noopener">Maps</a>
    </div>

    <div class="scripts-box">
      <div class="scripts-title">Scripts rapides</div>
      <div class="scripts-item">
        <div class="scripts-label">Appel</div>
        <p>${escape(QUICK_CALL_SCRIPT)}</p>
        <button class="quick-btn secondary" id="copyCallScriptBtn">Copier</button>
      </div>
      <div class="scripts-item">
        <div class="scripts-label">SMS</div>
        <p>${escape(QUICK_SMS_SCRIPT)}</p>
        <button class="quick-btn secondary" id="copySmsScriptBtn">Copier</button>
      </div>
    </div>

    <a class="detail-maps-link" href="${s.googleMapsUrl}" target="_blank" rel="noopener">
      Voir sur Google Maps ↗
    </a>

    ${parcoursSet.has(`${s.name}||${s.address}`)
      ? `<button class="btn-add-parcours btn-added" id="addParcoursBtn" disabled>Déjà dans le parcours</button>`
      : `<button class="btn-add-parcours" id="addParcoursBtn">+ Ajouter au parcours</button>`
    }
  `;

  if (isMobile()) {
    openMobileOverlay(html);
  } else {
    detailPanel.classList.remove('hidden');
    detailPanel.innerHTML = html;
  }

  // Attach after render (element now exists in DOM)
  document.getElementById('addParcoursBtn')?.addEventListener('click', () => addToParcours(s));
  document.getElementById('copyPhoneBtn')?.addEventListener('click', () => copyToClipboard(s.phone || ''));
  document.getElementById('copySmsBtn')?.addEventListener('click', () => copyToClipboard(buildSmsMessage(s)));
  document.getElementById('copyCallScriptBtn')?.addEventListener('click', () => copyToClipboard(QUICK_CALL_SCRIPT));
  document.getElementById('copySmsScriptBtn')?.addEventListener('click', () => copyToClipboard(QUICK_SMS_SCRIPT));
}

// ─── Parcours ─────────────────────────────────────────────────────────────────

async function addToParcours(prospect) {
  const btn = document.getElementById('addParcoursBtn');
  if (!btn || btn.classList.contains('btn-added')) return;
  btn.disabled = true;
  btn.textContent = 'Ajout...';

  try {
    const res = await fetch(`${API_URL}/parcours/add`, {
      method: 'POST',
      headers: Auth.authHeaders(),
      body: JSON.stringify({
        name: prospect.name,
        address: prospect.address,
        phone: prospect.phone,
        score: prospect.score,
        website: prospect.website,
        rating: prospect.rating,
        reviews: prospect.reviews,
        google_maps_url: prospect.googleMapsUrl,
        notes: '',
        visit_status: 'pending',
        status: 'not_done', // Default status: non fait
        lat: prospect.lat,
        lng: prospect.lng,
      }),
    });

    if (res.status === 401) { Auth.logout(); return; }
    if (!res.ok) throw new Error('Erreur serveur');

    btn.textContent = 'Déjà dans le parcours';
    btn.classList.add('btn-added');
    btn.disabled = true;
    parcoursSet.add(`${prospect.name}||${prospect.address}`);
  } catch {
    btn.disabled = false;
    btn.textContent = '+ Ajouter au parcours';
  }
}

// ─── Tags & utils ─────────────────────────────────────────────────────────────

function scorePriority(score) {
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function webTag(s) {
  if (!s.website) return `<span class="tag no-site">🔴 Pas de site</span>`;
  if (s.siteHealth === 'weak' || s.isBadSite) return `<span class="tag bad-site">🟠 Site faible</span>`;
  if (s.siteHealth === 'improvable') return `<span class="tag platform">⚠️ Site a ameliorer</span>`;
  if (s.platforms?.length) return `<span class="tag platform">${s.platforms.join(', ')}</span>`;
  return `<span class="tag has-site">🟢 Site propre</span>`;
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function scoreLabelText(label) {
  if (label === 'opportunity') return 'Opportunite';
  if (label === 'medium') return 'Moyen';
  return 'Faible';
}

function siteHealthText(s) {
  if (!s.website) return 'Pas de site';
  if (s.siteHealth === 'weak' || s.isBadSite) return 'Site faible';
  if (s.siteHealth === 'improvable') return 'Site a ameliorer';
  return 'OK';
}

function siteHealthClass(s) {
  if (!s.website) return 'weak';
  if (s.siteHealth === 'weak' || s.isBadSite) return 'weak';
  if (s.siteHealth === 'improvable') return 'improvable';
  return 'correct';
}

function applyFilters(results) {
  const noWebsiteOnly = filterNoWebsite?.checked;
  const minRating = Number(filterMinRating?.value || 0);
  const minScore = Number(filterMinScore?.value || 0);
  const category = (filterCategory?.value || '').trim().toLowerCase();

  return results.filter((item) => {
    if (noWebsiteOnly && item.website) return false;
    if (minRating > 0 && (item.rating ?? 0) < minRating) return false;
    if (minScore > 0 && (item.score ?? 0) < minScore) return false;
    if (category && !item.name.toLowerCase().includes(category)) return false;
    return true;
  });
}

function buildSmsMessage(prospect) {
  if (!prospect) return '';

  const name = prospect.name || 'votre établissement';

  // Détection simple du type
  const type = (prospect.types || []).join(' ').toLowerCase();

  let label = 'établissements';

  if (type.includes('hair') || type.includes('beauty')) label = 'salons';
  else if (type.includes('restaurant') || type.includes('food')) label = 'restaurants';
  else if (type.includes('gym') || type.includes('fitness')) label = 'salles de sport';
  else if (type.includes('car') || type.includes('garage')) label = 'garages';
  else if (type.includes('store') || type.includes('shop')) label = 'commerces';

  return `Bonjour, je vous contacte car j'aide les ${label} comme ${name} à obtenir plus de clients via Google et à automatiser les réservations. Est-ce que vous avez déjà un site ou pas vraiment optimisé aujourd'hui ?`;
}

async function copyToClipboard(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copie dans le presse-papiers');
    setTimeout(clearStatus, 1000);
  } catch {
    setStatus('Impossible de copier', true);
  }
}

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

function highlightMatch(text, query) {
  if (!query) return escape(text);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escape(text);
  return escape(text.slice(0, idx))
    + `<mark class="ac-highlight">${escape(text.slice(idx, idx + query.length))}</mark>`
    + escape(text.slice(idx + query.length));
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden', 'error');
  if (isError) statusEl.classList.add('error');
}

function clearStatus() {
  statusEl.classList.add('hidden');
}

// ─── Events ───────────────────────────────────────────────────────────────────

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  search();
});

// Inputs → activer/désactiver bouton
locationInput.addEventListener('input', updateSearchButtonState);
queryInput.addEventListener('input', updateSearchButtonState);

// Init état bouton au chargement
document.addEventListener('DOMContentLoaded', updateSearchButtonState);

// Filtres
filterNoWebsite?.addEventListener('change', renderResults);
filterMinRating?.addEventListener('input', renderResults);
filterMinScore?.addEventListener('input', renderResults);
filterCategory?.addEventListener('input', renderResults);

// ─── Autocomplete + History (Île-de-France priority) ─────────────────────────

const IDF_TERMS = /île.de.france|paris|hauts.de.seine|seine.saint.denis|val.de.marne|essonne|yvelines|val.d.oise|seine.et.marne/i;

// Make initAutocomplete globally accessible for Google Maps callback
window.initAutocomplete = function() {
  const autocompleteService = new google.maps.places.AutocompleteService();
  const placesService       = new google.maps.places.PlacesService(document.createElement('div'));
  const dropdown            = document.getElementById('autocomplete-dropdown');
  const IDF_CENTER          = new google.maps.LatLng(48.8566, 2.3522);

  locationInput.addEventListener('focus', () => {
    if (!locationInput.value.trim()) renderDropdown(searchHistory, [], '');
  });

  locationInput.addEventListener('input', () => {
    searchLat = null;
    searchLng = null;
    clearTimeout(acDebounce);

    const query = locationInput.value.trim();
    if (!query) {
      renderDropdown(searchHistory, [], '');
      return;
    }

    acDebounce = setTimeout(() => {
      const historyMatches = searchHistory.filter(h =>
        h.toLowerCase().includes(query.toLowerCase())
      );

      autocompleteService.getPlacePredictions(
        {
          input: query,
          location: IDF_CENTER,
          radius: 80000,
          componentRestrictions: { country: 'fr' },
        },
        (predictions, status) => {
          const preds = (status === google.maps.places.PlacesServiceStatus.OK && predictions) ? predictions : [];
          renderDropdown(historyMatches, preds, query);
        }
      );
    }, 300);
  });

  locationInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideDropdown();
  });

  function renderDropdown(historyItems, predictions, query) {
    dropdown.innerHTML = '';
    const presetItems = getLocationPresetSuggestions(query);

    if (!historyItems.length && !presetItems.length && !predictions.length) {
      hideDropdown();
      return;
    }

    if (historyItems.length) {
      if (!query) {
        const header = document.createElement('div');
        header.className = 'ac-section-header';
        header.textContent = 'Recherches récentes';
        dropdown.appendChild(header);
      }
      historyItems.forEach(loc => dropdown.appendChild(createHistoryItem(loc, query)));
    }

    if (presetItems.length) {
      const header = document.createElement('div');
      header.className = 'ac-section-header';
      header.textContent = 'Suggestions localisation';
      dropdown.appendChild(header);
      presetItems.forEach((loc) => dropdown.appendChild(createPresetItem(loc, query)));
    }

    const maxPreds = Math.max(0, 8 - historyItems.length - presetItems.length);
    predictions.slice(0, maxPreds).forEach((pred) => {
      const isIDF = IDF_TERMS.test(pred.description);
      const item  = document.createElement('div');
      item.className = 'autocomplete-item' + (isIDF ? ' idf' : '');
      const mainText = pred.structured_formatting?.main_text ?? pred.description;
      const secText  = pred.structured_formatting?.secondary_text ?? '';
      item.innerHTML = `
        <span class="ac-main">${highlightMatch(mainText, query)}</span>
        <span class="ac-secondary">${escape(secText)}</span>
        ${isIDF ? '<span class="ac-badge">Île-de-France</span>' : ''}
      `;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectPrediction(pred);
      });
      dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
  }

  async function createHistoryItem(loc, query) {
    const item = document.createElement('div');
    item.className = 'autocomplete-item history-item';

    const icon = document.createElement('span');
    icon.className = 'ac-icon';
    icon.textContent = '🕐';

    const main = document.createElement('span');
    main.className = 'ac-main';
    main.innerHTML = query ? highlightMatch(loc, query) : escape(loc);

    const del = document.createElement('button');
    del.className = 'ac-delete';
    del.title = "Supprimer de l'historique";
    del.textContent = '×';

    item.append(icon, main, del);

    del.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeFromHistory(loc);
      item.remove();
      if (!dropdown.querySelector('.autocomplete-item')) hideDropdown();
    });

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      locationInput.value = loc;
      searchLat = null;
      searchLng = null;
      hideDropdown();
      updateSearchButtonState();
    });

    return item;
  }

  function createPresetItem(loc, query) {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.innerHTML = `
      <span class="ac-main">${highlightMatch(loc, query)}</span>
      <span class="ac-secondary">Suggestion rapide</span>
    `;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      locationInput.value = loc;
      searchLat = null;
      searchLng = null;
      hideDropdown();
      updateSearchButtonState();
    });
    return item;
  }

  function hideDropdown() {
    dropdown.classList.add('hidden');
  }

  function selectPrediction(pred) {
    locationInput.value = pred.description;
    hideDropdown();
    updateSearchButtonState();

    placesService.getDetails(
      { placeId: pred.place_id, fields: ['geometry'] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry) {
          searchLat = place.geometry.location.lat();
          searchLng = place.geometry.location.lng();
        }
      }
    );
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-wrapper')) hideDropdown();
  });
};

function getLocationPresetSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [...arrondissementSuggestions.slice(0, 5), ...districtSuggestions.slice(0, 4)];

  const all = [...arrondissementSuggestions, ...districtSuggestions];
  return all
    .filter((item) => item.toLowerCase().includes(q))
    .slice(0, 6);
}

function seenKey(s) {
  return `${s.name}||${s.address}`;
}