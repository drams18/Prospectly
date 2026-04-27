import axios from 'axios';
import { promisePool } from './pool.js';

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

// Niche → synonyms used for Google Places TextSearch
export const KEYWORD_MAP = {
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

// All niche names — used by the frontend to list scan categories
export const SCAN_NICHES = Object.keys(KEYWORD_MAP);

const FRANCHISE_BLACKLIST = [
  'saint algue', 'franck provost', 'jean-louis david', 'dessange',
  'jacques dessange', 'camille albane', 'toni&guy', 'toni & guy',
  "l'oréal", 'great lengths', 'hair success',
  'mcdonald', 'burger king', 'subway', 'kfc', 'quick',
];

/**
 * Expand a free-form query into search keywords via KEYWORD_MAP.
 * Returns [query] unchanged if no mapping is found.
 */
export function expandKeywords(query) {
  const q = query.trim().toLowerCase();
  if (KEYWORD_MAP[q]) return KEYWORD_MAP[q];
  for (const [key, kws] of Object.entries(KEYWORD_MAP)) {
    if (q.includes(key) || key.includes(q)) return kws;
  }
  return [query.trim()];
}

/**
 * Search Google Places around a GPS point.
 *
 * mode='single'  – expand `query` via KEYWORD_MAP, run in parallel
 * mode='multi'   – use the provided `keywords` array directly
 * mode='scan'    – run every keyword in KEYWORD_MAP in parallel (smart scan)
 *
 * Returns a deduplicated array of raw Place objects.
 */
export async function searchPlaces({ lat, lng, radius, query = '', keywords = [], mode = 'single' }) {
  let searchTerms;

  if (mode === 'scan') {
    searchTerms = [...new Set(Object.values(KEYWORD_MAP).flat())];
  } else if (mode === 'multi' && keywords.length > 0) {
    searchTerms = keywords.map(k => k.trim()).filter(Boolean);
  } else {
    searchTerms = expandKeywords(query);
  }

  const tasks = searchTerms.map(kw => () => textSearch({ lat, lng, radius, query: kw }));
  const batches = await promisePool(tasks, 4);

  const seen = new Map();
  for (const batch of batches) {
    for (const place of batch) seen.set(place.place_id, place);
  }

  return [...seen.values()];
}

async function textSearch({ lat, lng, radius, query }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const results = [];
  let pageToken = null;

  do {
    const params = { query, location: `${lat},${lng}`, radius, key: apiKey, language: 'fr' };
    if (pageToken) {
      params.pagetoken = pageToken;
      await sleep(2000);
    }

    const { data } = await axios.get(`${PLACES_BASE}/textsearch/json`, { params });

    if (!['OK', 'ZERO_RESULTS'].includes(data.status)) {
      console.warn(`  [TextSearch "${query}"] ${data.status}`);
      break;
    }

    results.push(...(data.results || []));
    pageToken = data.next_page_token || null;
  } while (pageToken && results.length < 20);

  return results;
}

export async function getPlaceDetails(placeId) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const fields = [
    'place_id', 'name', 'formatted_address', 'formatted_phone_number',
    'website', 'rating', 'user_ratings_total', 'geometry',
    'business_status', 'types', 'url',
  ].join(',');

  const { data } = await axios.get(`${PLACES_BASE}/details/json`, {
    params: { place_id: placeId, fields, key: apiKey, language: 'fr' },
  });

  if (data.status !== 'OK') return null;
  return data.result;
}

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function isFranchise(name) {
  const lower = name.toLowerCase();
  return FRANCHISE_BLACKLIST.some((f) => lower.includes(f));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
