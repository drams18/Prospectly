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
  const { username, password, start_address } = req.body ?? {};

  if (!username?.trim() || !password || password.length < 6) {
    return res.status(400).json({ error: 'Username et mot de passe (min 6 caractères) requis' });
  }

  try {
    const hash = await hashPassword(password);
    const stmt = db.prepare(
      'INSERT INTO users (username, password_hash, start_address) VALUES (?, ?, ?)'
    );
    const id = stmt.run(username.trim(), hash, start_address ?? null).lastInsertRowid;
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

app.get('/me', requireAuth, (req, res) => {
  try {
    // Convert user ID to number to match database type
    const userId = Number(req.user.sub);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }

    const user = db.prepare(
      'SELECT id, username, start_address FROM users WHERE id = ?'
    ).get(userId);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Return clean JSON response
    res.json({
      id: user.id,
      username: user.username,
      start_address: user.start_address
    });
  } catch (err) {
    console.error('[/me] Error:', err);
    // Return 500 with safe error message (don't expose internal details)
    res.status(500).json({ error: 'Erreur serveur lors de la récupération du profil' });
  }
});

app.patch('/me', requireAuth, (req, res) => {
  const { start_address, username, current_password } = req.body ?? {};

  try {
    // Convert user ID to number to match database type
    const userId = Number(req.user.sub);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }

    const updates = [];
    const values = [];

    if (start_address !== undefined) {
      updates.push('start_address = ?');
      values.push(start_address ?? null);
    }

    if (username !== undefined && current_password !== undefined) {
      // Verify current password
      const user = db.prepare(
        'SELECT password_hash FROM users WHERE id = ?'
      ).get(userId);

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur introuvable' });
      }

      const validPassword = verifyPassword(current_password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      // Check if username is already taken
      const existingUser = findUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({ error: "Nom d'utilisateur déjà pris" });
      }

      if (username.length < 3) {
        return res.status(400).json({ error: 'Le nom d\'utilisateur doit faire au moins 3 caractères' });
      }

      updates.push('username = ?');
      values.push(username.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }

    values.push(userId);

    db.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    res.json({ ok: true });
  } catch (err) {
    console.error('[/me PATCH]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Account deletion ──────────────────────────────────────────────────────────

app.delete('/account', requireAuth, (req, res) => {
  try {
    // Convert user ID to number to match database type
    const userId = Number(req.user.sub);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }
    
    // Delete all related data first (cascading should handle this, but being explicit)
    db.prepare('DELETE FROM parcours WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM seen_prospects WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM search_history WHERE user_id = ?').run(userId);
    
    // Delete the user
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /account]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Clear history ──────────────────────────────────────────────────────────

app.delete('/history', requireAuth, (req, res) => {
  try {
    const userId = Number(req.user.sub);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }
    db.prepare('DELETE FROM search_history WHERE user_id = ?').run(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /history]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.delete('/seen/clear', requireAuth, (req, res) => {
  try {
    const userId = Number(req.user.sub);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }
    db.prepare('DELETE FROM seen_prospects WHERE user_id = ?').run(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /seen/clear]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
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
  const { 
    name, address, phone, score, website, rating, reviews, 
    google_maps_url, notes = '', visit_status = 'pending',
    lat, lng 
  } = req.body ?? {};
  
  if (!name?.trim()) return res.status(400).json({ error: 'name requis' });

  const normalizedVisitStatus = ['pending', 'visited', 'absent'].includes(visit_status) ? visit_status : 'pending';
  const existing = db.prepare(
    `SELECT id FROM parcours WHERE user_id = ? AND name = ? AND COALESCE(address,'') = COALESCE(?, '')`
  ).get(req.user.sub, name.trim(), address ?? null);

  if (existing) {
    db.prepare(
      `UPDATE parcours
       SET phone = ?, score = ?, website = ?, rating = ?, reviews = ?, google_maps_url = ?,
           notes = ?, visit_status = ?, lat = ?, lng = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      phone ?? null, score ?? null, website ?? null, rating ?? null, reviews ?? null, google_maps_url ?? null,
      notes ?? '', normalizedVisitStatus, lat ?? null, lng ?? null, existing.id, req.user.sub
    );
    return res.json({ id: existing.id, updated: true });
  }

  // New parcours items start with status 'not_done' by default
  const result = db.prepare(
    `INSERT INTO parcours (user_id, name, address, phone, score, website, rating, reviews, google_maps_url, notes, visit_status, status, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_done', ?, ?)`
  ).run(
    req.user.sub, name.trim(), address ?? null, phone ?? null, score ?? null, website ?? null, rating ?? null, reviews ?? null,
    google_maps_url ?? null, notes ?? '', normalizedVisitStatus, lat ?? null, lng ?? null
  );

  res.json({ id: result.lastInsertRowid, created: true });
});

app.get('/parcours', requireAuth, async (req, res) => {
  const { user_address } = req.query ?? {};
  
  // Get user's stored address if not provided
  let refLat = null, refLng = null;
  
  try {
    if (user_address) {
      // If user provided an address for this search, geocode it
      const coords = await geocodeAddress(user_address);
      refLat = coords.lat;
      refLng = coords.lng;
    } else {
      // Use user's stored address
      const user = db.prepare('SELECT start_address FROM users WHERE id = ?').get(req.user.sub);
      if (user?.start_address) {
        const coords = await geocodeAddress(user.start_address);
        refLat = coords.lat;
        refLng = coords.lng;
      }
    }
  } catch (err) {
    // If geocoding fails, we'll just sort by created_at
  }
  
  // Get parcours items sorted by distance if we have reference coordinates
  let rows;
  if (refLat != null && refLng != null) {
    rows = db.prepare(`
      SELECT *, 
        (((? - lat) * (? - lat)) + ((? - lng) * (? - lng))) as distance_sq
      FROM parcours 
      WHERE user_id = ? AND lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY distance_sq ASC, created_at DESC
    `).all(refLat, refLat, refLng, refLng, req.user.sub);
    
    // Also get items without coordinates and append them at the end
    const noCoords = db.prepare(`
      SELECT * FROM parcours 
      WHERE user_id = ? AND (lat IS NULL OR lng IS NULL)
      ORDER BY created_at DESC
    `).all(req.user.sub);
    
    rows = [...rows, ...noCoords];
  } else {
    rows = db.prepare(
      'SELECT * FROM parcours WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.sub);
  }
  
  res.json({ parcours: rows });
});

// Get favorites only
app.get('/parcours/favorites', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM parcours WHERE user_id = ? AND is_favorite = 1 ORDER BY created_at DESC'
  ).all(req.user.sub);
  res.json({ parcours: rows });
});

app.patch('/parcours/:id', requireAuth, (req, res) => {
  const { status, notes, visit_status, is_favorite, lat, lng } = req.body ?? {};
  const VALID_STATUSES = ['done', 'not_done'];
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
  
  if (visit_status != null) {
    if (!VALID_VISIT_STATUSES.includes(visit_status)) return res.status(400).json({ error: 'Etat visite invalide' });
    updates.push('visit_status = ?');
    values.push(visit_status);
  }
  
  if (is_favorite != null) {
    updates.push('is_favorite = ?');
    values.push(is_favorite ? 1 : 0);
  }
  
  if (lat != null) {
    updates.push('lat = ?');
    values.push(lat);
  }
  
  if (lng != null) {
    updates.push('lng = ?');
    values.push(lng);
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

// ─── Seen prospects routes ────────────────────────────────────────────────────

app.get('/seen', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT name, address, seen_at FROM seen_prospects WHERE user_id = ? ORDER BY seen_at DESC'
  ).all(req.user.sub);
  res.json({ seen: rows });
});

app.post('/seen', requireAuth, (req, res) => {
  const { name, address } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'name requis' });

  try {
    db.prepare(
      'INSERT OR IGNORE INTO seen_prospects (user_id, name, address) VALUES (?, ?, ?)'
    ).run(req.user.sub, name.trim(), address ?? null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/seen/:name', requireAuth, (req, res) => {
  const { address } = req.query;
  db.prepare(
    'DELETE FROM seen_prospects WHERE user_id = ? AND name = ? AND COALESCE(address,\'\') = COALESCE(?, \'\')'
  ).run(req.user.sub, req.params.name, address ?? null);
  res.json({ ok: true });
});

// ─── Search history routes ────────────────────────────────────────────────────

app.get('/history', requireAuth, (req, res) => {
  const { limit = 10 } = req.query;
  const rows = db.prepare(
    'SELECT location, searched_at FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT ?'
  ).all(req.user.sub, parseInt(limit));
  res.json({ history: rows });
});

app.post('/history', requireAuth, (req, res) => {
  const { location } = req.body ?? {};
  if (!location?.trim()) return res.status(400).json({ error: 'location requis' });

  try {
    db.prepare(
      'INSERT INTO search_history (user_id, location) VALUES (?, ?)'
    ).run(req.user.sub, location.trim());
    
    // Keep only last 10 entries
    db.prepare(`
      DELETE FROM search_history 
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM search_history 
        WHERE user_id = ? 
        ORDER BY searched_at DESC LIMIT 10
      )
    `).run(req.user.sub, req.user.sub);
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/history/:location', requireAuth, (req, res) => {
  db.prepare(
    'DELETE FROM search_history WHERE user_id = ? AND location = ?'
  ).run(req.user.sub, req.params.location);
  res.json({ ok: true });
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── 404 handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Prospectly backend → http://localhost:${PORT}`);
});
