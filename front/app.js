const API_URL = 'http://localhost:3001';

const locationInput = document.getElementById('locationInput');
const searchBtn     = document.getElementById('searchBtn');
const statusEl      = document.getElementById('status');
const toolbarEl     = document.getElementById('toolbar');
const resultCountEl = document.getElementById('resultCount');
const resultsEl     = document.getElementById('results');
const downloadBtn   = document.getElementById('downloadBtn');
const detailPanel   = document.getElementById('detailPanel');

let currentResults   = [];
let displayedResults = [];
let selectedIndex    = null;

// ─── Search ───────────────────────────────────────────────────────────────────

async function search() {
  const location = locationInput.value.trim();
  if (!location) return;

  setStatus('Recherche en cours…');
  searchBtn.disabled = true;
  resultsEl.innerHTML = '';
  detailPanel.classList.add('hidden');
  selectedIndex = null;
  displayedResults = [];
  toolbarEl.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location }),
    });

    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);

    currentResults = await res.json();
    renderResults(currentResults);
    clearStatus();
  } catch (err) {
    setStatus(`Erreur : ${err.message}`, true);
  } finally {
    searchBtn.disabled = false;
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderResults(data) {
  if (!data.length) {
    setStatus('Aucun résultat trouvé.');
    return;
  }

  displayedResults = data.slice(0, 30);

  resultCountEl.textContent = `${displayedResults.length} prospect${displayedResults.length > 1 ? 's' : ''} trouvé${displayedResults.length > 1 ? 's' : ''}`;
  toolbarEl.classList.remove('hidden');

  resultsEl.innerHTML = displayedResults.map((s, i) => `
    <div class="card" data-index="${i}">
      <div class="score-badge ${scorePriority(s.score)}">${s.score}</div>
      <div class="card-body">
        <div class="card-name">${escape(s.name)}</div>
        <div class="card-address">${escape(s.address)}</div>
        <div class="card-meta">
          ${webTag(s)}
          ${s.rating ? `<span class="tag rating">★ ${s.rating}</span>` : ''}
          ${s.reviews ? `<span class="tag reviews">${s.reviews} avis</span>` : ''}
        </div>
      </div>
      <button class="detail-btn" title="Voir le détail">👁</button>
    </div>
  `).join('');

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

  resultsEl.querySelectorAll('.card').forEach((card) => {
    card.classList.toggle('selected', parseInt(card.dataset.index, 10) === index);
  });

  renderDetail(displayedResults[index]);
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
    </div>

    <div class="detail-meta">
      ${webTag(s)}
      ${s.rating  ? `<span class="tag rating">★ ${s.rating}</span>`     : ''}
      ${s.reviews ? `<span class="tag reviews">${s.reviews} avis</span>` : ''}
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

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function downloadCSV() {
  if (!currentResults.length) return;

  const headers = ['Nom', 'Adresse', 'Score', 'Note', 'Avis', 'Site web', 'Plateformes', 'Google Maps'];
  const rows = currentResults.map((s) => [
    s.name,
    s.address,
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
