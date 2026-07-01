import { createClient } from 'npm:@supabase/supabase-js@2';
import { cacheGet, cacheSet } from './cache.ts';
import { CATEGORY_GROUPS } from './categories.ts';
import { isAllowedBusiness } from './filters.ts';
import { geocodeAddress } from './geocode.ts';
import {
  computeAdaptiveRadii, getPlaceDetails, haversineDistance, isFranchise,
  searchPlaces, searchPlacesCount, SCAN_NICHES,
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
    location, lat, lng, query = '', businessType = '', keywords = [], mode = 'single',
    hasWebsite, hasBooking: filterHasBooking, minRating = 0, minReviews = 0,
    category = '', onlyHot = false, categoryCounts = false,
  } = body as {
    location?: string; lat?: number; lng?: number; query?: string; businessType?: string;
    keywords?: string[]; mode?: 'single' | 'multi' | 'scan'; hasWebsite?: boolean;
    hasBooking?: boolean; minRating?: number; minReviews?: number; category?: string;
    onlyHot?: boolean; categoryCounts?: boolean;
  };

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
    const noFranchise = rawPlaces.filter(p => !isFranchise(p.name ?? ''));

    const tasks = noFranchise.map(place => async () => {
      try {
        const details = await getPlaceDetails(place.place_id, apiKey);
        if (!details) return null;

        if (!isAllowedBusiness({ name: details.name ?? place.name, types: details.types ?? place.types })) {
          return null;
        }

        const placeLat = details.geometry?.location?.lat ?? place.geometry?.location?.lat;
        const placeLng = details.geometry?.location?.lng ?? place.geometry?.location?.lng;

        const distance = (placeLat != null && placeLng != null)
          ? haversineDistance(searchLat!, searchLng!, placeLat, placeLng)
          : null;

        const photo = details.photos?.[0] || place.photos?.[0] || null;
        const photoReference = photo?.photo_reference ?? null;

        const website = details.website ?? null;
        const { hasBooking, bookingType } = detectBooking(website);
        const hasInstagram = detectInstagram(website);

        const lead = {
          placeId: place.place_id,
          name: details.name ?? place.name,
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
          imageUrl: buildGooglePlacePhotoUrl(photoReference, apiKey),
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
    });

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
