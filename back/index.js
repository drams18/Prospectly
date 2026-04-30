import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import db from './src/db.js';
import { cacheGet, cacheSet } from './src/cacheManager.js';
import { hashPassword, verifyPassword, signToken, requireAuth, findUserByUsername, createUser } from './src/auth.js';
import { analyzeWebsite } from './src/enrich.js';
import { computeScore, getScoreLabel, sortResults } from './src/score.js';
import { promisePool } from './src/pool.js';
import { geocodeAddress } from './src/geocode.js';
import { searchPlaces, getPlaceDetails, haversineDistance, isFranchise, SCAN_NICHES, computeAdaptiveRadii } from './src/places.js';

const app = express();
const PORT = process.env.PORT || 3001;
const PLACES_PHOTO_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/photo';

function buildGooglePlacePhotoUrl(photoReference) {
  if (!photoReference) return null;
  const photoParams = new URLSearchParams({
    maxwidth: '1200',
    photoreference: photoReference,
    key: process.env.GOOGLE_MAPS_API_KEY,
  });
  return `${PLACES_PHOTO_ENDPOINT}?${photoParams.toString()}`;
}

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
 *   businessType string – type d'enseigne (UI only, optional)
 *   query     string   – legacy compat field (ignored in mode=single)
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
  const normalizedBusinessType = businessType.trim().toLowerCase();
  const effectiveType = (normalizedBusinessType || query || '').trim();

  if (!location?.trim()) {
    return res.status(400).json({ error: 'location requis' });
  }
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY manquante dans .env' });
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
        : ['single', normalizedBusinessType || 'all'];
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
      keywords,
      mode,
      locationText: location.trim(),
      businessType: normalizedBusinessType,
    });
    const filtered = rawPlaces.filter(p => !isFranchise(p.name ?? ''));

    // Parallel enrichment (max 5 concurrent)
    const tasks = filtered.map(place => async () => {
      try {
        const details = await getPlaceDetails(place.place_id);
        if (!details) return null;
    
        const placeLat = details.geometry?.location?.lat ?? place.geometry?.location?.lat;
        const placeLng = details.geometry?.location?.lng ?? place.geometry?.location?.lng;
    
        const distance = (placeLat != null && placeLng != null)
          ? haversineDistance(searchLat, searchLng, placeLat, placeLng)
          : null;
    
        const photo =
          details.photos?.[0] ||
          place.photos?.[0] ||
          null;
    
        const photoReference = photo?.photo_reference ?? null;
    
        // ⚡ FAST MODE : pas de scraping ici
        const hasWebsite = !!details.website;
    
        const lead = {
          name: details.name ?? place.name,
          address: details.formatted_address ?? place.vicinity ?? '',
          phone: details.formatted_phone_number ?? null,
          rating: details.rating ?? place.rating ?? null,
          reviews: details.user_ratings_total ?? place.user_ratings_total ?? 0,
    
          // simplifié
          website: details.website ?? null,
          hasWebsite,
    
          platforms: [],
          isBadSite: false,
          badSiteReasons: [],
          siteHealth: hasWebsite ? 'unknown' : 'none',
    
          siteQuality: null,
          responseTime: null,
          hasHttps: details.website?.startsWith('https') ?? false,
          hasMetaTitle: null,
          hasViewport: null,
          mobileReachable: null,
    
          googleMapsUrl:
            details.url ??
            `https://maps.google.com/?q=${encodeURIComponent(details.name ?? place.name)}`,
    
          imageUrl: buildGooglePlacePhotoUrl(photoReference),
          distance,
        };
    
        // ⚡ score rapide (sans analyse site)
        const score = computeScore(lead);
    
        return { ...lead, score, scoreLabel: getScoreLabel(score) };
    
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
      ...(mode === 'single' && { businessType: effectiveType || null, radii: adaptiveRadii }),
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
  const { name, address, phone, score, website, rating, reviews, google_maps_url, notes = '', in_tour = 0, visit_status = 'pending', tour_order = null } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'name requis' });

  const normalizedVisitStatus = ['pending', 'visited', 'absent'].includes(visit_status) ? visit_status : 'pending';
  const normalizedInTour = in_tour ? 1 : 0;
  const existing = db.prepare(
    `SELECT id FROM parcours WHERE user_id = ? AND name = ? AND COALESCE(address,'') = COALESCE(?, '')`
  ).get(req.user.sub, name.trim(), address ?? null);

  if (existing) {
    db.prepare(
      `UPDATE parcours
       SET phone = ?, score = ?, website = ?, rating = ?, reviews = ?, google_maps_url = ?,
           notes = ?, in_tour = ?, visit_status = ?, tour_order = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      phone ?? null, score ?? null, website ?? null, rating ?? null, reviews ?? null, google_maps_url ?? null,
      notes ?? '', normalizedInTour, normalizedVisitStatus, tour_order, existing.id, req.user.sub
    );
    return res.json({ id: existing.id, updated: true });
  }

  const result = db.prepare(
    `INSERT INTO parcours (user_id, name, address, phone, score, website, rating, reviews, google_maps_url, notes, in_tour, visit_status, tour_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.sub, name.trim(), address ?? null, phone ?? null, score ?? null, website ?? null, rating ?? null, reviews ?? null,
    google_maps_url ?? null, notes ?? '', normalizedInTour, normalizedVisitStatus, tour_order
  );

  res.json({ id: result.lastInsertRowid, created: true });
});

app.get('/parcours', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM parcours WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.sub);
  res.json({ parcours: rows });
});

app.patch('/parcours/:id', requireAuth, (req, res) => {
  const { status, notes, in_tour, visit_status, tour_order } = req.body ?? {};
  const VALID_STATUSES = ['todo', 'visited', 'interested', 'not_interested'];
  const VALID_VISIT_STATUSES = ['pending', 'visited', 'absent'];

  const updates = [];
  const values = [];
  if (status != null) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Statut invalide' });
    updates.push('status = ?');
    values.push(status);
  }
  if (typeof notes === 'string') {
    updates.push('notes = ?');
    values.push(notes);
  }
  if (in_tour != null) {
    updates.push('in_tour = ?');
    values.push(in_tour ? 1 : 0);
  }
  if (visit_status != null) {
    if (!VALID_VISIT_STATUSES.includes(visit_status)) return res.status(400).json({ error: 'Etat visite invalide' });
    updates.push('visit_status = ?');
    values.push(visit_status);
  }
  if (tour_order != null) {
    updates.push('tour_order = ?');
    values.push(tour_order);
  }
  if (!updates.length) return res.status(400).json({ error: 'Aucune modification fournie' });

  const result = db.prepare(
    `UPDATE parcours SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
  ).run(...values, req.params.id, req.user.sub);

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

app.get('/tour', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM parcours
     WHERE user_id = ? AND in_tour = 1
     ORDER BY
      CASE WHEN tour_order IS NULL THEN 1 ELSE 0 END,
      tour_order ASC,
      created_at DESC`
  ).all(req.user.sub);
  res.json({ tour: rows });
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Prospectly backend → http://localhost:${PORT}`);
});
