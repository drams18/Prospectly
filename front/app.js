const API_URL = 'http://localhost:3001';

const locationInput    = document.getElementById('locationInput');
const searchBtn        = document.getElementById('searchBtn');
const filtersContainer = document.getElementById('filtersContainer');
const resetBtn         = document.getElementById('resetBtn');
const filterErrorEl    = document.getElementById('filterError');

const filterBtns = document.querySelectorAll('.filter-btn');
let filtersLocked = false;

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (filtersLocked) return;
    filterBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    filtersLocked = true;
    filtersContainer.classList.add('locked');
    resetBtn.classList.remove('hidden');
    filterErrorEl.classList.add('hidden');
  });
});

function getSelectedQuery() {
  const active = document.querySelector('.filter-btn.active');
  return active ? active.dataset.query : null;
}

const statusEl      = document.getElementById('status');
const toolbarEl     = document.getElementById('toolbar');
const resultCountEl = document.getElementById('resultCount');
const resultsEl     = document.getElementById('results');
const downloadBtn   = document.getElementById('downloadBtn');
const detailPanel   = document.getElementById('detailPanel');

let currentResults   = [];
let displayedResults = [];
let selectedIndex    = null;
let searchLat        = null;
let searchLng        = null;
let acDebounce       = null;
let currentPage      = 1;
const PAGE_SIZE      = 10;

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

// ─── Reset ────────────────────────────────────────────────────────────────────

function resetSearch() {
  filtersLocked = false;
  filterBtns.forEach((b) => b.classList.remove('active'));
  filtersContainer.classList.remove('locked');
  resetBtn.classList.add('hidden');
  filterErrorEl.classList.add('hidden');
  currentResults = [];
  displayedResults = [];
  resultsEl.innerHTML = '';
  detailPanel.classList.add('hidden');
  toolbarEl.classList.add('hidden');
  selectedIndex = null;
  clearStatus();
}

// ─── Search ───────────────────────────────────────────────────────────────────

async function search() {
  const location = locationInput.value.trim();
  if (!location) return;

  const query = getSelectedQuery();
  if (!query) {
    filterErrorEl.textContent = 'Veuillez sélectionner un type de business';
    filterErrorEl.classList.remove('hidden');
    return;
  }
  filterErrorEl.classList.add('hidden');

  setStatus('Recherche en cours…');
  searchBtn.disabled = true;
  resultsEl.innerHTML = '';
  detailPanel.classList.add('hidden');
  selectedIndex = null;
  displayedResults = [];
  currentResults = [];
  currentPage = 1;
  toolbarEl.classList.add('hidden');

  try {
    const body = { location, query };
    if (searchLat != null && searchLng != null) {
      body.lat = searchLat;
      body.lng = searchLng;
    }

    const res = await fetch(`${API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);

    const data = await res.json();
    currentResults = Array.isArray(data) ? data : (data.results ?? []);
    renderResults();
    clearStatus();
  } catch (err) {
    setStatus(`Erreur : ${err.message}`, true);
  } finally {
    searchBtn.disabled = false;
  }
}

function loadMore() {
  currentPage += 1;
  renderResults();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderResults() {
  if (!currentResults.length) {
    setStatus('Aucun résultat trouvé.');
    return;
  }

  const seen = loadSeen();
  displayedResults = currentResults.slice(0, currentPage * PAGE_SIZE);
  const hasMore = displayedResults.length < currentResults.length;

  resultCountEl.textContent = `${currentResults.length} prospect${currentResults.length > 1 ? 's' : ''} trouvé${currentResults.length > 1 ? 's' : ''}`;
  toolbarEl.classList.remove('hidden');

  const cards = displayedResults.map((s, i) => {
    const isSeen = seen.has(seenKey(s));
    return `
      <div class="card${isSeen ? ' seen' : ''}" data-index="${i}">
        <div class="score-badge ${scorePriority(s.score)}">${s.score}</div>
        <div class="card-body">
          <div class="card-name">${escape(s.name)}</div>
          <div class="card-address">${escape(s.address)}</div>
          <div class="card-meta">
            ${isSeen ? '<span class="badge-seen">Déjà vue</span>' : ''}
            ${webTag(s)}
            ${s.rating ? `<span class="tag rating">★ ${s.rating}</span>` : ''}
            ${s.reviews ? `<span class="tag reviews">${s.reviews} avis</span>` : ''}
            ${s.distance != null ? `<span class="tag distance">${formatDistance(s.distance)}</span>` : ''}
          </div>
        </div>
        <button class="detail-btn" title="Voir le détail">👁</button>
      </div>
    `;
  }).join('');

  const loadMoreHtml = hasMore
    ? `<button id="loadMoreBtn" class="load-more-btn">Voir plus de résultats</button>`
    : '';

  resultsEl.innerHTML = cards + loadMoreHtml;

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMore);

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

  detailPanel.classList.remove('hidden');
  detailPanel.innerHTML = `
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
        <div class="detail-value">${phone ? escape(phone) : notFound}</div>
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
  `;
}

function scorePriority(score) {
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function webTag(s) {
  if (!s.website) return `<span class="tag no-site">Pas de site web</span>`;
  if (s.platforms.length) return `<span class="tag platform">${s.platforms.join(', ')}</span>`;
  return `<span class="tag has-site">Site propre</span>`;
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

// ─── CSV ──────────────────────────────────────────────────────────────────────

function downloadCSV() {
  if (!currentResults.length) return;

  const headers = ['Nom', 'Adresse', 'Distance', 'Score', 'Note', 'Avis', 'Site web', 'Plateformes', 'Google Maps'];
  const rows = currentResults.map((s) => [
    s.name,
    s.address,
    s.distance != null ? formatDistance(s.distance) : '',
    s.score,
    s.rating ?? '',
    s.reviews ?? '',
    s.website ?? '',
    (s.platforms ?? []).join(' / '),
    s.googleMapsUrl,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `prospectly_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
downloadBtn.addEventListener('click', downloadCSV);
resetBtn.addEventListener('click', resetSearch);

// ─── Autocomplete (Île-de-France priority) ────────────────────────────────────

const IDF_TERMS = /île.de.france|paris|hauts.de.seine|seine.saint.denis|val.de.marne|essonne|yvelines|val.d.oise|seine.et.marne/i;

function initAutocomplete() {
  const autocompleteService = new google.maps.places.AutocompleteService();
  const placesService       = new google.maps.places.PlacesService(document.createElement('div'));
  const dropdown            = document.getElementById('autocomplete-dropdown');
  const IDF_CENTER          = new google.maps.LatLng(48.8566, 2.3522);

  locationInput.addEventListener('input', () => {
    searchLat = null;
    searchLng = null;
    clearTimeout(acDebounce);

    const query = locationInput.value.trim();
    if (!query) { hideDropdown(); return; }

    acDebounce = setTimeout(() => {
      autocompleteService.getPlacePredictions(
        {
          input: query,
          location: IDF_CENTER,
          radius: 80000,
          componentRestrictions: { country: 'fr' },
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
            showDropdown(predictions);
          } else {
            hideDropdown();
          }
        }
      );
    }, 300);
  });

  locationInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideDropdown();
  });

  function showDropdown(predictions) {
    dropdown.innerHTML = '';
    predictions.slice(0, 6).forEach((pred) => {
      const isIDF = IDF_TERMS.test(pred.description);
      const item  = document.createElement('div');
      item.className = 'autocomplete-item' + (isIDF ? ' idf' : '');
      item.innerHTML = `
        <span class="ac-main">${escape(pred.structured_formatting?.main_text ?? pred.description)}</span>
        <span class="ac-secondary">${escape(pred.structured_formatting?.secondary_text ?? '')}</span>
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
