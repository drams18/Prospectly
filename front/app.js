// Auth guard — redirect if not logged in
if (!Auth.getToken()) window.location.href = 'login.html';

// Auth bar
document.getElementById('usernameDisplay').textContent = Auth.getUsername() ?? '';
document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());

const locationInput    = document.getElementById('locationInput');
const searchBtn        = document.getElementById('searchBtn');
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
let searchLat        = null;
let searchLng        = null;
let acDebounce       = null;
let parcoursSet      = new Set();
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
    const data = await res.json();
    parcoursSet = new Set((data.parcours || []).map(p => `${p.name}||${p.address}`));
  } catch {}
}

loadParcoursSet();

// ─── Seen prospects (localStorage) ────────────────────────────────────────────

function seenKey(s) {
  return `${s.name}||${s.address}`;
}

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem('prospectly_seen') || '[]'));
  } catch {
    return new Set();
  }
}

function markSeen(s) {
  const seen = loadSeen();
  seen.add(seenKey(s));
  localStorage.setItem('prospectly_seen', JSON.stringify([...seen]));
}

// ─── Search history (localStorage) ────────────────────────────────────────────

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('prospectly_history') || '[]'); }
  catch { return []; }
}

function addToHistory(location) {
  const history = loadHistory().filter(h => h !== location);
  history.unshift(location);
  localStorage.setItem('prospectly_history', JSON.stringify(history.slice(0, 10)));
}

function removeFromHistory(location) {
  localStorage.setItem('prospectly_history', JSON.stringify(
    loadHistory().filter(h => h !== location)
  ));
}

// ─── Search ───────────────────────────────────────────────────────────────────

function updateSearchButtonState() {
  const location = locationInput.value.trim();
  searchBtn.disabled = !location;
}

async function search() {
  const location = locationInput.value.trim();
  const businessType = queryInput.value.trim();
  if (!location) return;

  setStatus('Recherche en cours…');
  searchBtn.disabled = true;
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
    addToHistory(location);
    renderResults();
    clearStatus();
  } catch (err) {
    console.error('[Prospectly] Erreur API /search :', err);
    setStatus(`Erreur : ${err.message}`, true);
  } finally {
    updateSearchButtonState();
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderResults() {
  if (!currentResults.length) {
    setStatus('Aucun résultat trouvé.');
    return;
  }

  const seen = loadSeen();
  displayedResults = currentResults;

  resultCountEl.textContent = `${currentResults.length} prospect${currentResults.length > 1 ? 's' : ''} trouvé${currentResults.length > 1 ? 's' : ''}`;
  toolbarEl.classList.remove('hidden');

  const cards = displayedResults.map((s, i) => {
    const isSeen = seen.has(seenKey(s));
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
          <div class="card-address">${escape(s.address)}</div>
          <div class="card-meta">
            ${isSeen ? '<span class="badge-seen">Déjà vue</span>' : ''}
            ${webTag(s)}
            ${s.rating ? `<span class="tag rating">★ ${s.rating}</span>` : ''}
            ${s.reviews ? `<span class="tag reviews">${s.reviews} avis</span>` : ''}
            ${s.distance != null ? `<span class="tag distance">${formatDistance(s.distance)}</span>` : ''}
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
      ${s.rating  ? `<span class="tag rating">★ ${s.rating}</span>`     : ''}
      ${s.reviews ? `<span class="tag reviews">${s.reviews} avis</span>` : ''}
      ${s.distance != null ? `<span class="tag distance">${formatDistance(s.distance)}</span>` : ''}
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
  if (s.isBadSite) return `<span class="tag bad-site">🟠 Site faible</span>`;
  if (s.platforms?.length) return `<span class="tag platform">${s.platforms.join(', ')}</span>`;
  return `<span class="tag has-site">🟢 Site propre</span>`;
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

searchBtn.addEventListener('click', search);
locationInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
queryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
locationInput.addEventListener('input', updateSearchButtonState);
queryInput.addEventListener('input', updateSearchButtonState);
queryInput.setAttribute('list', 'businessTypeSuggestions');
updateSearchButtonState();

// ─── Autocomplete + History (Île-de-France priority) ─────────────────────────

const IDF_TERMS = /île.de.france|paris|hauts.de.seine|seine.saint.denis|val.de.marne|essonne|yvelines|val.d.oise|seine.et.marne/i;

function initAutocomplete() {
  const autocompleteService = new google.maps.places.AutocompleteService();
  const placesService       = new google.maps.places.PlacesService(document.createElement('div'));
  const dropdown            = document.getElementById('autocomplete-dropdown');
  const IDF_CENTER          = new google.maps.LatLng(48.8566, 2.3522);

  locationInput.addEventListener('focus', () => {
    if (!locationInput.value.trim()) renderDropdown(loadHistory(), [], '');
  });

  locationInput.addEventListener('input', () => {
    searchLat = null;
    searchLng = null;
    clearTimeout(acDebounce);

    const query = locationInput.value.trim();
    if (!query) {
      renderDropdown(loadHistory(), [], '');
      return;
    }

    acDebounce = setTimeout(() => {
      const historyMatches = loadHistory().filter(h =>
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

  function createHistoryItem(loc, query) {
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
}

function getLocationPresetSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [...arrondissementSuggestions.slice(0, 5), ...districtSuggestions.slice(0, 4)];

  const all = [...arrondissementSuggestions, ...districtSuggestions];
  return all
    .filter((item) => item.toLowerCase().includes(q))
    .slice(0, 6);
}
