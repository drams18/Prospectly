import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';

import db from './src/db.js';
import { cacheGet, cacheSet } from './src/cacheManager.js';
import { hashPassword, verifyPassword, signToken, requireAuth, findUserByUsername, createUser } from './src/auth.js';
import { analyzeWebsite } from './src/enrich.js';
import { computeScore, sortResults } from './src/score.js';
import { promisePool } from './src/pool.js';
import { geocodeAddress } from './src/geocode.js';
import { getPlaceDetails, haversineDistance, isFranchise } from './src/places.js';

const app = express();
const PORT = process.env.PORT || 3001;
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

app.use(cors({
  origin: ['https://drams18.github.io', 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function nearbySearch(lat, lng, keyword, pageToken = null) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const params = { key: apiKey, language: 'fr' };

  if (pageToken) {
    params.pagetoken = pageToken;
    await new Promise(r => setTimeout(r, 2000));
  } else {
    params.location = `${lat},${lng}`;
    params.radius = 2000;
    params.keyword = keyword;
  }

  const { data } = await axios.get(`${PLACES_BASE}/nearbysearch/json`, { params });
  return {
    results: data.results ?? [],
    nextPageToken: data.next_page_token ?? null,
  };
}

async function searchPlaces(lat, lng, keyword) {
  const MAX = 50;
  let all = [];
  let { results, nextPageToken } = await nearbySearch(lat, lng, keyword);
  all = all.concat(results);

  while (nextPageToken && all.length < MAX) {
    const next = await nearbySearch(lat, lng, keyword, nextPageToken);
    all = all.concat(next.results);
    nextPageToken = next.nextPageToken;
  }

  return all.slice(0, MAX);
}

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

app.post('/search', async (req, res) => {
  const { location, lat, lng, query } = req.body ?? {};

  if (!location?.trim()) {
    return res.status(400).json({ error: 'location requis' });
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY manquante dans .env' });
  }

  try {
    const keyword = (typeof query === 'string' && query.trim()) ? query.trim() : 'barber';

    // Geocode if no coordinates provided
    let searchLat = typeof lat === 'number' ? lat : null;
    let searchLng = typeof lng === 'number' ? lng : null;
    if (searchLat == null || searchLng == null) {
      const coords = await geocodeAddress(location.trim());
      searchLat = coords.lat;
      searchLng = coords.lng;
    }

    // Cache check
    const cacheKey = `${searchLat.toFixed(4)}_${searchLng.toFixed(4)}_${keyword}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ results: cached });

    // Search places
    const places = await searchPlaces(searchLat, searchLng, keyword);
    const filtered = places.filter(p => !isFranchise(p.name ?? ''));

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

        const salon = {
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

        return { ...salon, score: computeScore(salon) };
      } catch {
        return null;
      }
    });

    const enriched = (await promisePool(tasks, 5)).filter(Boolean);
    const sorted = sortResults(enriched);

    cacheSet(cacheKey, sorted);
    res.json({ results: sorted });
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
