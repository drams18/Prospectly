// Scripts de prospection — chargement depuis l'API et affichage

document.addEventListener('DOMContentLoaded', function () {
  if (!Auth.requireAuth()) return;

  const usernameDisplay = document.getElementById('usernameDisplay');
  if (usernameDisplay) usernameDisplay.textContent = Auth.getUsername() || '';

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());

  loadScripts();
});

const CATEGORY_TITLES = {
  accroche: 'Accroches',
  corps: 'Corps du message',
  question: 'Questions ouvertes',
  objection: 'Réponses aux objections',
};

const EMAIL_LABELS = {
  standard: 'Standard',
  professionnelle: 'Professionnelle',
  decontractee: 'Décontractée',
  courte: 'Très courte',
};

async function loadScripts() {
  const container = document.getElementById('scriptsContent');
  if (!container) return;

  try {
    const res = await fetch(`${API_URL}/scripts`, { headers: Auth.authHeaders() });
    if (!res.ok) {
      if (res.status === 401) {
        Auth.logout();
        return;
      }
      throw new Error('Erreur lors du chargement des scripts');
    }

    const { scripts } = await res.json();
    renderScripts(container, scripts || []);
  } catch (err) {
    console.error('[Scripts] Erreur chargement:', err);
    container.innerHTML = '';
    const error = document.createElement('p');
    error.className = 'scripts-loading';
    error.textContent = 'Impossible de charger les scripts pour le moment.';
    container.appendChild(error);
  }
}

function renderScripts(container, scripts) {
  container.innerHTML = '';

  const byType = { call: [], sms: [], email: [] };
  for (const s of scripts) {
    if (byType[s.type]) byType[s.type].push(s);
  }

  container.appendChild(renderCallSection(byType.call));
  container.appendChild(renderSmsSection(byType.sms));
  container.appendChild(renderEmailSection(byType.email));
}

function renderCallSection(items) {
  const section = document.createElement('div');
  section.className = 'profile-section';

  const h2 = document.createElement('h2');
  h2.textContent = 'Appel téléphonique (20-30 secondes)';
  section.appendChild(h2);

  const byCategory = groupBy(items, 'category');

  for (const category of ['accroche', 'corps', 'question', 'objection']) {
    const rows = byCategory[category];
    if (!rows || !rows.length) continue;

    const subtitle = document.createElement('h3');
    subtitle.className = 'script-subtitle';
    subtitle.textContent = CATEGORY_TITLES[category] || category;
    section.appendChild(subtitle);

    const list = document.createElement('div');
    list.className = 'script-list';

    for (const row of rows) {
      if (category === 'objection') {
        list.appendChild(buildObjectionCard(row));
      } else {
        list.appendChild(buildScriptCard(row.content));
      }
    }

    section.appendChild(list);
  }

  return section;
}

function renderSmsSection(items) {
  const section = document.createElement('div');
  section.className = 'profile-section';

  const h2 = document.createElement('h2');
  h2.textContent = 'SMS';
  section.appendChild(h2);

  const list = document.createElement('div');
  list.className = 'script-list';

  for (const row of items) {
    const card = buildScriptCard(row.content, row.label);
    const length = document.createElement('span');
    length.className = 'sms-length';
    length.textContent = `${row.content.length} caractères`;
    card.querySelector('.script-card-header').appendChild(length);
    list.appendChild(card);
  }

  section.appendChild(list);
  return section;
}

const EMAIL_ORDER = ['standard', 'professionnelle', 'decontractee', 'courte'];

function renderEmailSection(items) {
  const section = document.createElement('div');
  section.className = 'profile-section';

  const h2 = document.createElement('h2');
  h2.textContent = 'E-mail';
  section.appendChild(h2);

  const list = document.createElement('div');
  list.className = 'script-list';

  const ordered = [...items].sort(
    (a, b) => EMAIL_ORDER.indexOf(a.category) - EMAIL_ORDER.indexOf(b.category)
  );

  for (const row of ordered) {
    const card = document.createElement('div');
    card.className = 'script-card';

    const header = document.createElement('div');
    header.className = 'script-card-header';

    const title = document.createElement('span');
    title.className = 'script-card-title';
    title.textContent = EMAIL_LABELS[row.category] || row.label || row.category;
    header.appendChild(title);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-secondary copy-btn';
    copyBtn.textContent = 'Copier';
    header.appendChild(copyBtn);

    card.appendChild(header);

    const subject = document.createElement('p');
    subject.className = 'email-subject';
    subject.innerHTML = '<strong>Objet :</strong> ';
    subject.appendChild(document.createTextNode(row.subject || ''));
    card.appendChild(subject);

    const body = document.createElement('p');
    body.className = 'script-card-content';
    body.textContent = row.content;
    card.appendChild(body);

    const fullText = `Objet : ${row.subject || ''}\n\n${row.content}`;
    copyBtn.addEventListener('click', () => copyToClipboard(fullText, copyBtn));

    list.appendChild(card);
  }

  section.appendChild(list);
  return section;
}

function buildScriptCard(content, label) {
  const card = document.createElement('div');
  card.className = 'script-card';

  const header = document.createElement('div');
  header.className = 'script-card-header';

  if (label) {
    const title = document.createElement('span');
    title.className = 'script-card-title';
    title.textContent = label;
    header.appendChild(title);
  }

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-secondary copy-btn';
  copyBtn.textContent = 'Copier';
  copyBtn.addEventListener('click', () => copyToClipboard(content, copyBtn));
  header.appendChild(copyBtn);

  card.appendChild(header);

  const text = document.createElement('p');
  text.className = 'script-card-content';
  text.textContent = content;
  card.appendChild(text);

  return card;
}

function buildObjectionCard(row) {
  const card = document.createElement('div');
  card.className = 'script-card objection-card';

  const trigger = document.createElement('p');
  trigger.className = 'objection-trigger';
  trigger.textContent = `« ${row.label} »`;
  card.appendChild(trigger);

  const header = document.createElement('div');
  header.className = 'script-card-header';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-secondary copy-btn';
  copyBtn.textContent = 'Copier';
  copyBtn.addEventListener('click', () => copyToClipboard(row.content, copyBtn));
  header.appendChild(copyBtn);

  card.appendChild(header);

  const text = document.createElement('p');
  text.className = 'script-card-content';
  text.textContent = row.content;
  card.appendChild(text);

  return card;
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    (acc[item[key]] ??= []).push(item);
    return acc;
  }, {});
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copié !';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1500);
  });
}
