import { promisePool } from './pool.ts';
import { filterOutChains } from './chains.ts';

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

export interface GooglePlace {
  place_id: string;
  name: string;
  types?: string[];
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: { location?: { lat: number; lng: number } };
  photos?: Array<{ photo_reference?: string }>;
}

export const KEYWORD_MAP: Record<string, string[]> = {
  coiffeur:    ['coiffeur', 'barber', 'barbershop', 'salon de coiffure'],
  restaurant:  ['restaurant', 'brasserie', 'bistrot'],
  boulangerie: ['boulangerie', 'pâtisserie'],
  onglerie:    ['onglerie', 'nail salon', 'manucure'],
  garage:      ['garage auto', 'mécanique auto', 'carrosserie'],
  cafe:        ['café', 'coffee shop', 'salon de thé'],
  esthetique:  ['institut de beauté', 'esthétique', 'spa'],
  fleuriste:   ['fleuriste'],
  boucherie:   ['boucherie', 'charcuterie'],
  pharmacie:   ['pharmacie'],
};

export const TYPE_FILTER_MAP: Record<string, string[]> = {
  boulangerie: ['bakery'],
  coiffeur: ['hair_care'],
  restaurant: ['restaurant'],
  cafe: ['cafe'],
  pharmacie: ['pharmacy'],
  garage: ['car_repair'],
  boutique: ['store'],
};

export const TYPE_MAP: Record<string, string> = {
  restaurant: 'restaurant',
  coiffeur: 'hair_care',
  garage: 'car_repair',
  hotel: 'lodging',
  cafe: 'cafe',
  boutique: 'store',
};

export const SCAN_NICHES = Object.keys(KEYWORD_MAP);

// Radius bands (meters) for the auto-feed. Each band is fetched as a full
// disc from the search center; the caller ring-diffs against the previous
// band's radius to only keep newly-covered businesses.
export const RADIUS_LADDER = [1500, 3000, 5000, 8000, 12000, 18000, 25000];

// Broad Google Nearby Search `type` values used to fan out a feed band.
// Scoping each call to a real business type (rather than a bare keyword-less
// search) avoids Google's prominence-ranking cap silently hiding businesses
// outside the top ~60 results, and keeps non-business noise (transit stops,
// parks, admin areas) out of the pipeline at the source.
const FEED_TYPE_BUCKETS = [
  'restaurant', 'store', 'beauty_salon', 'car_repair',
  'health', 'lodging', 'gym', 'real_estate_agency',
];

export function expandKeywords(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (KEYWORD_MAP[q]) return KEYWORD_MAP[q];
  for (const [key, kws] of Object.entries(KEYWORD_MAP)) {
    if (q.includes(key) || key.includes(q)) return kws;
  }
  return [query.trim()];
}

export function resolveGooglePlaceType(typeInput = ''): string | null {
  const normalized = typeInput.trim().toLowerCase();
  if (!normalized) return null;

  if (TYPE_MAP[normalized]) return TYPE_MAP[normalized];

  const byFilterMap = TYPE_FILTER_MAP[normalized];
  if (byFilterMap?.length) return byFilterMap[0];

  if (normalized.includes('coiff')) return 'hair_care';
  if (normalized.includes('restau') || normalized.includes('brasserie') || normalized.includes('bistrot')) return 'restaurant';
  if (normalized.includes('garage') || normalized.includes('carross')) return 'car_repair';
  if (normalized.includes('boutique') || normalized.includes('magasin')) return 'store';
  if (normalized.includes('pharma')) return 'pharmacy';
  if (normalized.includes('cafe') || normalized.includes('café')) return 'cafe';
  return null;
}

export function computeAdaptiveRadii(locationText = '', fallbackRadius = 2000): number[] {
  const text = locationText.trim().toLowerCase();
  const baseRadius = Number.isFinite(fallbackRadius) ? fallbackRadius : 2000;

  const isStreetLevel = /\b\d{1,4}\s+\S+/.test(text) || /\brue\b|\bavenue\b|\bboulevard\b|\bplace\b|\bquai\b/.test(text);
  const isArrondissement = /\b75(0[0-9]|1[0-9]|20)\b/.test(text) || /\bparis\s*\d{1,2}(?:e|er)?\b/.test(text);
  const isDistrict = /\bbastille|republique|république|opera|opéra|marais|montmartre|batignolles|nation|belleville|pigalle|oberkampf\b/.test(text);

  let radius = baseRadius;
  if (isStreetLevel) radius = 500;
  else if (isArrondissement || isDistrict) radius = 1500;
  else radius = 3000;

  radius = Math.min(3000, Math.max(500, radius));
  const secondary = Math.min(3000, radius + 800);
  return [...new Set([radius, secondary, 3000])].sort((a, b) => a - b);
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface NearbySearchParams {
  lat: number;
  lng: number;
  radius: number;
  keyword?: string | null;
  placeType?: string | null;
  apiKey: string;
}

async function nearbySearch({ lat, lng, radius, keyword, placeType, apiKey }: NearbySearchParams): Promise<GooglePlace[]> {
  const results: GooglePlace[] = [];
  let pageToken: string | null = null;

  do {
    const url = new URL(`${PLACES_BASE}/nearbysearch/json`);
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'fr');
    if (keyword) url.searchParams.set('keyword', keyword);
    if (placeType) url.searchParams.set('type', placeType);
    if (pageToken) {
      url.searchParams.set('pagetoken', pageToken);
      await sleep(2000);
    }

    const res = await fetch(url);
    const data = await res.json();
    if (!['OK', 'ZERO_RESULTS'].includes(data.status)) break;

    results.push(...(data.results || []));
    pageToken = data.next_page_token || null;
  } while (pageToken);

  return results;
}

export interface FeedCategory {
  id: string;
  type: string | null;
  keywords: string[];
}

export interface SearchFeedBandParams {
  lat: number;
  lng: number;
  radius: number;
  apiKey: string;
  categories?: FeedCategory[];
}

export interface SearchFeedBandResult {
  places: GooglePlace[];
  // place_id -> ids of the requested categories whose Nearby Search call
  // returned it. Only populated when `categories` was provided — lets the
  // caller re-validate matches (see index.ts) since Google's Nearby Search
  // `type=` param matches ANY type in a place's `types` array, not just its
  // primary business type (a supermarket with a floral corner is a real
  // `florist` match for Google, not just for `type=supermarket`).
  categoryMatches: Map<string, Set<string>>;
}

// Fans a feed band out across broad business-type buckets instead of a bare
// keyword-less search: Google's Nearby Search ranks by prominence and caps
// at ~60 results per call regardless of radius, so an unscoped call would
// permanently miss anything outside the top ~60 as the radius grows.
//
// When `categories` is provided (user-picked category filter), the fan-out
// is scoped to those categories instead of the default buckets: one call
// per category, `type=` when the category has an exact/broad Google Place
// Type, `keyword=` otherwise (still Google's own matching — never an
// app-side name.includes()).
export async function searchFeedBand({ lat, lng, radius, apiKey, categories }: SearchFeedBandParams): Promise<SearchFeedBandResult> {
  const categoryMatches = new Map<string, Set<string>>();

  const tasks = categories?.length
    ? categories.map(cat => async () => {
        try {
          const places = await nearbySearch({
            lat, lng, radius, apiKey,
            placeType: cat.type,
            keyword: cat.type ? null : (cat.keywords[0] ?? null),
          });
          return places.map(place => ({ place, categoryId: cat.id }));
        } catch { return [] as Array<{ place: GooglePlace; categoryId: string }>; }
      })
    : FEED_TYPE_BUCKETS.map(placeType => async () => {
        try {
          const places = await nearbySearch({ lat, lng, radius, placeType, apiKey });
          return places.map(place => ({ place, categoryId: null as string | null }));
        } catch { return [] as Array<{ place: GooglePlace; categoryId: string | null }>; }
      });
  const batches = await promisePool(tasks, 4);

  const seen = new Map<string, GooglePlace>();
  for (const batch of batches) {
    for (const { place, categoryId } of batch) {
      seen.set(place.place_id, place);
      if (categoryId) {
        const ids = categoryMatches.get(place.place_id) ?? new Set<string>();
        ids.add(categoryId);
        categoryMatches.set(place.place_id, ids);
      }
    }
  }

  return { places: filterOutChains([...seen.values()]), categoryMatches };
}

export interface SearchPlacesParams {
  lat: number;
  lng: number;
  radius: number;
  query?: string;
  keywords?: string[];
  mode?: 'single' | 'multi' | 'scan';
  locationText?: string;
  businessType?: string;
  apiKey: string;
}

export async function searchPlaces({
  lat, lng, radius, query = '', keywords = [], mode = 'single', locationText = '', businessType = '', apiKey,
}: SearchPlacesParams): Promise<GooglePlace[]> {
  let searchTerms: string[];
  const resolvedPlaceType = resolveGooglePlaceType(businessType || query || '');

  if (mode === 'single') {
    searchTerms = [];
  } else if (mode === 'scan') {
    searchTerms = [...new Set(Object.values(KEYWORD_MAP).flat())];
  } else if (mode === 'multi' && keywords.length > 0) {
    searchTerms = keywords.map(k => k.trim()).filter(Boolean);
  } else {
    searchTerms = expandKeywords(query);
  }

  const radii = computeAdaptiveRadii(locationText, radius);
  const tasks: Array<() => Promise<GooglePlace[]>> = [];

  for (const kw of (searchTerms.length ? searchTerms : [null])) {
    for (const currentRadius of radii) {
      tasks.push(() => nearbySearch({ lat, lng, radius: currentRadius, keyword: kw, placeType: resolvedPlaceType, apiKey }));
    }
  }

  const batches = await promisePool(tasks, 4);

  const seen = new Map<string, GooglePlace>();
  for (const batch of batches) {
    for (const place of batch) {
      seen.set(place.place_id, place);
    }
  }

  const allPlaces = [...seen.values()];

  let filtered = allPlaces;
  if (resolvedPlaceType) {
    filtered = filtered.filter(place =>
      Array.isArray(place.types) && place.types.includes(resolvedPlaceType)
    );
  }

  if (mode !== 'single') {
    const typeFilters = TYPE_FILTER_MAP[query?.toLowerCase()] || [];
    if (typeFilters.length) {
      filtered = allPlaces.filter(place =>
        place.types?.some(t => typeFilters.includes(t))
      );
    } else {
      filtered = allPlaces.filter(place => {
        const name = (place.name || '').toLowerCase();
        const types = place.types || [];

        return searchTerms.some(term => {
          const t = term.toLowerCase();
          return (
            name.includes(t) ||
            types.some(type => type.includes(t))
          );
        });
      });
    }
  }

  filtered = filterOutChains(filtered);

  return filtered;
}

export interface PlaceDetails {
  place_id: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: { location?: { lat: number; lng: number } };
  business_status?: string;
  types?: string[];
  url?: string;
  photos?: Array<{ photo_reference?: string }>;
  opening_hours?: { open_now?: boolean; weekday_text?: string[] };
}

export async function getPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetails | null> {
  const fields = [
    'place_id', 'name', 'formatted_address', 'formatted_phone_number', 'website',
    'rating', 'user_ratings_total', 'geometry', 'business_status', 'types', 'url', 'photos',
    'opening_hours',
  ].join(',');

  const url = new URL(`${PLACES_BASE}/details/json`);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', fields);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('language', 'fr');

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK') return null;
  return data.result;
}

interface NearbySearchOnceParams {
  lat: number;
  lng: number;
  radius: number;
  keyword?: string | null;
  placeType?: string | null;
  apiKey: string;
}

async function nearbySearchOnce({ lat, lng, radius, keyword, placeType, apiKey }: NearbySearchOnceParams): Promise<GooglePlace[]> {
  const url = new URL(`${PLACES_BASE}/nearbysearch/json`);
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('key', apiKey);
  url.searchParams.set('language', 'fr');
  if (keyword) url.searchParams.set('keyword', keyword);
  if (placeType) url.searchParams.set('type', placeType);

  const res = await fetch(url);
  const data = await res.json();
  if (!['OK', 'ZERO_RESULTS'].includes(data.status)) return [];
  return data.results || [];
}

export interface FeedCategoryCountsParams {
  lat: number;
  lng: number;
  radius: number;
  categories: Array<{ id: string; type: string | null; keywords: string[] }>;
  apiKey: string;
}

// One cheap single-page nearbySearch per category (no Details calls, no
// pagination) — used to preview "N prospects" per category when the user
// expands a group in the category filter sheet.
export async function searchFeedCategoryCounts({ lat, lng, radius, categories, apiKey }: FeedCategoryCountsParams): Promise<Record<string, number>> {
  const tasks = categories.map(cat => async () => {
    try {
      const places = await nearbySearchOnce({
        lat, lng, radius, apiKey,
        placeType: cat.type,
        keyword: cat.type ? null : (cat.keywords[0] ?? null),
      });
      return [cat.id, places] as const;
    } catch { return [cat.id, [] as GooglePlace[]] as const; }
  });
  const results = await promisePool(tasks, 4);
  return Object.fromEntries(results.map(([id, places]) => [id, places.length]));
}

export interface SearchPlacesCountParams {
  lat: number;
  lng: number;
  radius: number;
  keywords: string[];
  apiKey: string;
}

// Lightweight count-only search: one nearbySearch page per keyword, no getPlaceDetails
export async function searchPlacesCount({ lat, lng, radius, keywords, apiKey }: SearchPlacesCountParams): Promise<GooglePlace[]> {
  const seen = new Map<string, GooglePlace>();
  const terms = keywords.slice(0, 2); // limit API calls per category
  const tasks = terms.map(kw => async () => {
    try { return await nearbySearchOnce({ lat, lng, radius, keyword: kw, apiKey }); }
    catch { return [] as GooglePlace[]; }
  });
  const batches = await promisePool(tasks, 4);
  for (const batch of batches) for (const place of batch) seen.set(place.place_id, place);
  return filterOutChains([...seen.values()]);
}
