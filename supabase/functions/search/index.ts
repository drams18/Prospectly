import { createClient } from 'npm:@supabase/supabase-js@2';
import { cacheGet, cacheSet } from './cache.ts';
import { CATEGORY_GROUPS, CATEGORY_MAP, deriveCategoryLabel, type Category } from './categories.ts';
import { filterOutChains } from './chains.ts';
import { isAllowedBusiness, isNoiseType } from './filters.ts';
import { geocodeAddress } from './geocode.ts';
import {
  computeAdaptiveRadii, getPlaceDetails, haversineDistance,
  RADIUS_LADDER, searchFeedBand, searchFeedCategoryCounts, searchPlaces, searchPlacesCount, SCAN_NICHES,
  type GooglePlace,
} from './places.ts';
import { promisePool } from './pool.ts';
import {
  applySearchFilters, computeFlags, computeScore, detectBooking, detectInstagram,
  getScoreLabel, sortResults, type ScoredLead,
} from './score.ts';

const PLACES_PHOTO_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/photo';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildGooglePlacePhotoUrl(photoReference: string | null, apiKey: string): string | null {
  if (!photoReference) return null;
  const params = new URLSearchParams({ maxwidth: '1200', photoreference: photoReference, key: apiKey });
  return `${PLACES_PHOTO_ENDPOINT}?${params.toString()}`;
}

function buildGooglePlacePhotoUrls(
  photos: Array<{ photo_reference?: string }> | undefined,
  apiKey: string,
  max = 5,
): string[] {
  if (!photos?.length) return [];
  return photos
    .slice(0, max)
    .map(p => buildGooglePlacePhotoUrl(p.photo_reference ?? null, apiKey))
    .filter((url): url is string => !!url);
}

interface EnrichContext {
  searchLat: number;
  searchLng: number;
  apiKey: string;
}

// Shared by every search mode: fetches Place Details, applies the halal
// filter + closed-business check, and builds the scored lead shape. Feed
// mode's ring fan-out and the legacy single/multi/scan pipeline both funnel
// their raw Google Places results through here.
async function enrichPlace(place: GooglePlace, { searchLat, searchLng, apiKey }: EnrichContext): Promise<ScoredLead | null> {
  try {
    const details = await getPlaceDetails(place.place_id, apiKey);
    if (!details) return null;
    if (details.business_status === 'CLOSED_PERMANENTLY') return null;

    const types = details.types ?? place.types ?? [];
    if (!isAllowedBusiness({ name: details.name ?? place.name, types })) return null;

    const placeLat = details.geometry?.location?.lat ?? place.geometry?.location?.lat;
    const placeLng = details.geometry?.location?.lng ?? place.geometry?.location?.lng;

    const distance = (placeLat != null && placeLng != null)
      ? haversineDistance(searchLat, searchLng, placeLat, placeLng)
      : null;

    const photoList = details.photos?.length ? details.photos : place.photos;
    const photos = buildGooglePlacePhotoUrls(photoList, apiKey);

    const website = details.website ?? null;
    const { hasBooking, bookingType } = detectBooking(website);
    const hasInstagram = detectInstagram(website);

    const openingHours = details.opening_hours
      ? { openNow: details.opening_hours.open_now ?? null, weekdayText: details.opening_hours.weekday_text ?? [] }
      : null;

    const lead = {
      placeId: place.place_id,
      name: details.name ?? place.name,
      category: deriveCategoryLabel(types),
      types,
      address: details.formatted_address ?? place.vicinity ?? '',
      phone: details.formatted_phone_number ?? null,
      rating: details.rating ?? place.rating ?? null,
      reviews: details.user_ratings_total ?? place.user_ratings_total ?? 0,
      website,
      hasWebsite: !!website,
      hasBooking,
      bookingType,
      hasInstagram,
      googleMapsUrl: details.url ?? `https://maps.google.com/?q=${encodeURIComponent(details.name ?? place.name)}`,
      imageUrl: photos[0] ?? null,
      photos,
      openingHours,
      lat: placeLat ?? null,
      lng: placeLng ?? null,
      distance,
    };

    const score = computeScore(lead);
    const flags = computeFlags(lead);

    return { ...lead, score, scoreLabel: getScoreLabel(score), ...flags };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return json({ error: 'GOOGLE_MAPS_API_KEY manquante' }, 500);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON invalide' }, 400);
  }

  const {
    location, lat, lng, query = '', businessType = '', keywords = [], mode = 'single', bandIndex = 0,
    hasWebsite, hasBooking: filterHasBooking, minRating = 0, minReviews = 0,
    category = '', onlyHot = false, categoryCounts = false, categoryIds, groupId,
  } = body as {
    location?: string; lat?: number; lng?: number; query?: string; businessType?: string;
    keywords?: string[]; mode?: 'single' | 'multi' | 'scan' | 'feed'; bandIndex?: number;
    hasWebsite?: boolean; hasBooking?: boolean; minRating?: number; minReviews?: number;
    category?: string; onlyHot?: boolean; categoryCounts?: boolean;
    categoryIds?: string[]; groupId?: string;
  };

  // Feed-mode category counts: a lightweight, lat/lng-only preview of "N
  // prospects" per category within one group, used by the category filter
  // sheet when the user expands a group. Bypasses geocoding entirely (same
  // reasoning as `mode: 'feed'` below) and only queries the categories in
  // the requested group, not the full taxonomy, to bound API call volume.
  if (categoryCounts && typeof lat === 'number' && typeof lng === 'number' && groupId) {
    try {
      const group = CATEGORY_GROUPS.find(g => g.id === groupId);
      if (!group) return json({ error: 'groupId inconnu' }, 400);

      const countsCacheKey = `counts_feed_${lat.toFixed(4)}_${lng.toFixed(4)}_${groupId}`;
      const cachedCounts = await cacheGet<Record<string, number>>(db, countsCacheKey);
      if (cachedCounts) return json({ counts: cachedCounts });

      const counts = await searchFeedCategoryCounts({
        lat, lng, radius: RADIUS_LADDER[0], apiKey,
        categories: group.categories.map(c => ({ id: c.id, type: c.type, keywords: c.keywords })),
      });
      await cacheSet(db, countsCacheKey, counts);
      return json({ counts });
    } catch (err) {
      console.error('[search:categoryCounts:feed]', err);
      return json({ error: err instanceof Error ? err.message : 'Erreur inconnue' }, 500);
    }
  }

  // Feed mode has its own, self-contained pipeline: no location text, no
  // geocoding, no keyword-based fan-out — just lat/lng from the browser and
  // a radius-band index. Handled before the shared single/multi/scan
  // pipeline below, which unconditionally requires a `location` string.
  if (mode === 'feed') {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return json({ error: 'lat/lng requis pour le mode feed' }, 400);
    }

    const band = Math.max(0, Math.floor(bandIndex));
    const selectedCategories = Array.isArray(categoryIds)
      ? categoryIds.map(id => CATEGORY_MAP[id]).filter((c): c is Category => !!c)
      : [];
    const catKey = selectedCategories.length ? [...categoryIds!].sort().join(',') : 'all';

    try {
      if (band >= RADIUS_LADDER.length) {
        return json({ results: [], meta: { mode: 'feed', bandIndex: band, exhausted: true } });
      }

      const cacheKey = `feed_${lat.toFixed(4)}_${lng.toFixed(4)}_${band}_${catKey}`;
      const cached = await cacheGet<ScoredLead[]>(db, cacheKey);
      if (cached) {
        return json({ results: cached, meta: { mode: 'feed', bandIndex: band, exhausted: false } });
      }

      const radius = RADIUS_LADDER[band];
      const prevRadius = band > 0 ? RADIUS_LADDER[band - 1] : 0;

      const { places: rawPlaces, categoryMatches } = await searchFeedBand({ lat, lng, radius, apiKey, categories: selectedCategories });

      // Ring-diff: only keep businesses newly covered by this band's larger
      // radius, so growing bands don't re-process the same inner disc.
      const ring = rawPlaces.filter(place => {
        const plat = place.geometry?.location?.lat;
        const plng = place.geometry?.location?.lng;
        if (plat == null || plng == null) return true;
        return haversineDistance(lat, lng, plat, plng) > prevRadius;
      });

      // Google's Nearby Search `type=` param matches ANY type in a place's
      // `types` array, not just its primary business type — e.g. a
      // supermarket with a floral corner genuinely carries `florist` as a
      // secondary type and comes back from `type=florist`. Re-validate that
      // the requested category's type is the place's PRIMARY type (types[0])
      // before trusting the match; categories with no Google type (keyword-
      // only) can't be re-checked this way, so they're trusted as-is.
      const categoryTypeById = new Map(selectedCategories.map(c => [c.id, c.type]));
      const matchesRequestedCategory = (place: GooglePlace) => {
        if (!selectedCategories.length) return true;
        const matchedIds = categoryMatches.get(place.place_id);
        if (!matchedIds?.size) return true;
        for (const id of matchedIds) {
          const type = categoryTypeById.get(id);
          if (!type || place.types?.[0] === type) return true;
        }
        return false;
      };

      // Cap Details-call volume: sort by prominence signals already present
      // on the raw Nearby Search response, no Details call needed for this.
      const candidates = ring
        .filter(place => !isNoiseType(place.types))
        .filter(matchesRequestedCategory)
        .sort((a, b) => (b.user_ratings_total ?? 0) - (a.user_ratings_total ?? 0))
        .slice(0, 40);

      const enrichTasks = candidates.map(place => async () => enrichPlace(place, { searchLat: lat, searchLng: lng, apiKey }));
      const enriched = (await promisePool(enrichTasks, 5)).filter((v): v is ScoredLead => v !== null);
      const sorted = sortResults(enriched);

      await cacheSet(db, cacheKey, sorted);

      return json({ results: sorted, meta: { mode: 'feed', bandIndex: band, exhausted: false } });
    } catch (err) {
      console.error('[search:feed]', err);
      return json({ error: err instanceof Error ? err.message : 'Erreur inconnue' }, 500);
    }
  }

  const normalizedBusinessType = (businessType || '').trim().toLowerCase();
  const effectiveType = (normalizedBusinessType || query || '').trim();

  if (!location?.trim()) return json({ error: 'location requis' }, 400);

  if (!categoryCounts) {
    if (mode === 'multi' && (!Array.isArray(keywords) || keywords.length === 0)) {
      return json({ error: 'keywords[] requis pour le mode multi' }, 400);
    }
    if (!['single', 'multi', 'scan'].includes(mode)) {
      return json({ error: "mode doit être 'single', 'multi' ou 'scan'" }, 400);
    }
  }

  try {
    let searchLat = typeof lat === 'number' ? lat : null;
    let searchLng = typeof lng === 'number' ? lng : null;
    if (searchLat == null || searchLng == null) {
      const coords = await geocodeAddress(location.trim(), apiKey);
      searchLat = coords.lat;
      searchLng = coords.lng;
    }

    const fallbackRadius = 2000;
    const adaptiveRadii = computeAdaptiveRadii(location.trim(), fallbackRadius);

    // ─── CATEGORY COUNTS ──────────────────────────────────────────────────
    if (categoryCounts) {
      const countsCacheKey = `counts_${searchLat.toFixed(4)}_${searchLng.toFixed(4)}`;
      const cachedCounts = await cacheGet<Record<string, number>>(db, countsCacheKey);
      if (cachedCounts) return json({ counts: cachedCounts });

      const allCategories = CATEGORY_GROUPS.flatMap(g => g.categories);
      const countTasks = allCategories.map(cat => async () => {
        const places = await searchPlacesCount({
          lat: searchLat!, lng: searchLng!, radius: fallbackRadius, keywords: cat.keywords, apiKey,
        });
        return [cat.id, places.filter(p => isAllowedBusiness(p)).length] as const;
      });
      const countEntries = await promisePool(countTasks, 4);
      const counts = Object.fromEntries(countEntries);
      await cacheSet(db, countsCacheKey, counts);
      return json({ counts });
    }

    const cacheKeyParts = mode === 'scan'
      ? ['scan']
      : mode === 'multi'
        ? ['multi', ...keywords.map(k => k.trim()).sort()]
        : ['single', normalizedBusinessType || 'all'];
    const cacheKey = `${searchLat.toFixed(4)}_${searchLng.toFixed(4)}_${cacheKeyParts.join('_')}`;

    const filters = { hasWebsite, hasBooking: filterHasBooking, minRating, minReviews, category, onlyHot };

    const cached = await cacheGet<ScoredLead[]>(db, cacheKey);
    if (cached) {
      const filtered = applySearchFilters(cached, filters);
      return json({ results: filtered, meta: { mode, total: filtered.length, totalUnfiltered: cached.length } });
    }

    const rawPlaces = await searchPlaces({
      lat: searchLat, lng: searchLng, radius: fallbackRadius, keywords, mode,
      locationText: location.trim(), businessType: normalizedBusinessType, apiKey,
    });
    const noFranchise = filterOutChains(rawPlaces);

    const tasks = noFranchise.map(place => async () => enrichPlace(place, { searchLat: searchLat!, searchLng: searchLng!, apiKey }));

    const enriched = (await promisePool(tasks, 5)).filter((v): v is ScoredLead => v !== null);
    const sorted = sortResults(enriched);
    await cacheSet(db, cacheKey, sorted);

    const filtered = applySearchFilters(sorted, filters);

    const meta = {
      mode,
      total: filtered.length,
      totalUnfiltered: sorted.length,
      ...(mode === 'scan' && { niches: SCAN_NICHES }),
      ...(mode === 'single' && { businessType: effectiveType || null, radii: adaptiveRadii }),
      ...(mode === 'multi' && { keywords }),
    };

    return json({ results: filtered, meta });
  } catch (err) {
    console.error('[search]', err);
    return json({ error: err instanceof Error ? err.message : 'Erreur inconnue' }, 500);
  }
});
