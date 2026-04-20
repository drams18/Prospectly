const API_URL = 'http://localhost:3001';

const locationInput = document.getElementById('locationInput');
const searchBtn     = document.getElementById('searchBtn');
const statusEl      = document.getElementById('status');
const toolbarEl     = document.getElementById('toolbar');
const resultCountEl = document.getElementById('resultCount');
const resultsEl     = document.getElementById('results');
const downloadBtn   = document.getElementById('downloadBtn');

let currentResults = [];

// ─── Search ───────────────────────────────────────────────────────────────────

async function search() {
  const location = locationInput.value.trim();
  if (!location) return;

  setStatus('Recherche en cours…');
  searchBtn.disabled = true;
  resultsEl.innerHTML = '';
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

  resultCountEl.textContent = `${data.length} prospect${data.length > 1 ? 's' : ''} trouvé${data.length > 1 ? 's' : ''}`;
  toolbarEl.classList.remove('hidden');

  resultsEl.innerHTML = data.map((s) => `
    <a class="card" href="${s.googleMapsUrl}" target="_blank" rel="noopener">
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
    </a>
  `).join('');
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
