import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import db from './src/db.js';
import { cacheGet, cacheSet } from './src/cacheManager.js';
import { hashPassword, verifyPassword, signToken, requireAuth, findUserByUsername, createUser } from './src/auth.js';
import { analyzeWebsite } from './src/enrich.js';
import { computeScore, sortResults } from './src/score.js';
import { promisePool } from './src/pool.js';
import { geocodeAddress } from './src/geocode.js';
import { searchPlaces, getPlaceDetails, haversineDistance, isFranchise, SCAN_NICHES, expandKeywords, computeAdaptiveRadii } from './src/places.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['https://drams18.github.io', 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username?.trim() || !password || password.length < 6) {
    return res.status(400).json({ error: 'Username et mot de passe (min 6 caractères) requis' });
  }

  try {
    const hash = await hashPassword(password);
    const id = createUser(username.trim(), hash);
    res.json({ ok: true, id });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: "Nom d'utilisateur déjà pris" });
    }
    throw err;
  }
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username et mot de passe requis' });
  }

  const user = findUserByUsername(username);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

  res.json({ token: signToken(user.id, user.username), username: user.username });
});

// ─── Search route ─────────────────────────────────────────────────────────────

/**
 * POST /search
 * Body:
 *   location  string   – human address or city (required)
 *   lat/lng   number   – skip geocoding when provided
 *   mode      string   – 'single' (default) | 'multi' | 'scan'
 *   query     string   – compat search term (mode=single)
 *   businessType string – type d'enseigne (mode=single)
 *   keywords  string[] – explicit keyword list (mode=multi)
 */
app.post('/search', async (req, res) => {
  const {
    location,
    lat,
    lng,
    query = '',
    businessType = '',
    keywords = [],
    mode = 'single',
  } = req.body ?? {};
  const effectiveType = (businessType || query || '').trim();

  if (!location?.trim()) {
    return res.status(400).json({ error: 'location requis' });
  }
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY manquante dans .env' });
  }
  if (mode === 'single' && !effectiveType) {
    return res.status(400).json({ error: 'businessType requis pour le mode single' });
  }
  if (mode === 'multi' && (!Array.isArray(keywords) || keywords.length === 0)) {
    return res.status(400).json({ error: 'keywords[] requis pour le mode multi' });
  }
  if (!['single', 'multi', 'scan'].includes(mode)) {
    return res.status(400).json({ error: "mode doit être 'single', 'multi' ou 'scan'" });
  }

  try {
    let searchLat = typeof lat === 'number' ? lat : null;
    let searchLng = typeof lng === 'number' ? lng : null;
    if (searchLat == null || searchLng == null) {
      const coords = await geocodeAddress(location.trim());
      searchLat = coords.lat;
      searchLng = coords.lng;
    }

    const fallbackRadius = parseInt(process.env.SEARCH_RADIUS || '2000');
    const adaptiveRadii = computeAdaptiveRadii(location.trim(), fallbackRadius);

    // Cache key encodes the full search intent
    const cacheKeyParts = mode === 'scan'
      ? ['scan']
      : mode === 'multi'
        ? ['multi', ...keywords.map(k => k.trim()).sort()]
        : ['single', effectiveType];
    const cacheKey = `${searchLat.toFixed(4)}_${searchLng.toFixed(4)}_${cacheKeyParts.join('_')}`;

    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json({ results: cached, meta: cached.__meta ?? null });
    }

    // Collect raw places (deduplicated by place_id)
    const rawPlaces = await searchPlaces({
      lat: searchLat,
      lng: searchLng,
      radius: fallbackRadius,
      query: effectiveType,
      businessType: effectiveType,
      keywords,
      mode,
      locationText: location.trim(),
    });
    const filtered = rawPlaces.filter(p => !isFranchise(p.name ?? ''));

    // Parallel enrichment (max 5 concurrent)
    const tasks = filtered.map(place => async () => {
      try {
        const details = await getPlaceDetails(place.place_id);
        if (!details) return null;

        const webInfo = await analyzeWebsite(details.website ?? null);

        const placeLat = details.geometry?.location?.lat ?? place.geometry?.location?.lat;
        const placeLng = details.geometry?.location?.lng ?? place.geometry?.location?.lng;
        const distance = (placeLat != null && placeLng != null)
          ? haversineDistance(searchLat, searchLng, placeLat, placeLng)
          : null;

        const lead = {
          name: details.name ?? place.name,
          address: details.formatted_address ?? place.vicinity ?? '',
          phone: details.formatted_phone_number ?? null,
          rating: details.rating ?? place.rating ?? null,
          reviews: details.user_ratings_total ?? place.user_ratings_total ?? 0,
          website: webInfo.websiteUrl,
          platforms: webInfo.platforms,
          isBadSite: webInfo.isBadSite,
          badSiteReasons: webInfo.badSiteReasons,
          googleMapsUrl: details.url ?? `https://maps.google.com/?q=${encodeURIComponent(details.name ?? place.name)}`,
          distance,
        };

        return { ...lead, score: computeScore(lead) };
      } catch {
        return null;
      }
    });

    const enriched = (await promisePool(tasks, 5)).filter(Boolean);
    const sorted = sortResults(enriched);

    const meta = {
      mode,
      total: sorted.length,
      ...(mode === 'scan' && { niches: SCAN_NICHES }),
      ...(mode === 'single' && { keywords: expandKeywords(effectiveType), businessType: effectiveType, radii: adaptiveRadii }),
      ...(mode === 'multi' && { keywords }),
    };

    cacheSet(cacheKey, sorted);
    res.json({ results: sorted, meta });
  } catch (err) {
    console.error('[/search]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Parcours routes ──────────────────────────────────────────────────────────

app.post('/parcours/add', requireAuth, (req, res) => {
  const { name, address, phone, score, website, rating, reviews, google_maps_url } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'name requis' });

  const result = db.prepare(
    `INSERT INTO parcours (user_id, name, address, phone, score, website, rating, reviews, google_maps_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.sub, name.trim(), address ?? null, phone ?? null, score ?? null, website ?? null, rating ?? null, reviews ?? null, google_maps_url ?? null);

  res.json({ id: result.lastInsertRowid });
});

app.get('/parcours', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM parcours WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.sub);
  res.json({ parcours: rows });
});

app.patch('/parcours/:id', requireAuth, (req, res) => {
  const { status } = req.body ?? {};
  const VALID_STATUSES = ['todo', 'visited', 'interested', 'not_interested'];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const result = db.prepare(
    `UPDATE parcours SET status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
  ).run(status, req.params.id, req.user.sub);

  if (!result.changes) return res.status(404).json({ error: 'Non trouvé' });
  res.json({ ok: true });
});

app.delete('/parcours/:id', requireAuth, (req, res) => {
  const result = db.prepare(
    'DELETE FROM parcours WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.user.sub);

  if (!result.changes) return res.status(404).json({ error: 'Non trouvé' });
  res.json({ ok: true });
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Prospectly backend → http://localhost:${PORT}`);
});
