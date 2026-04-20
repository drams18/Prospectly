import axios from 'axios';

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

// Mots-clés et types ciblés
const SEARCH_QUERIES = ['barber', 'barbershop', 'salon de coiffure', 'coiffeur'];
const PLACE_TYPES = ['hair_care', 'beauty_salon'];

// Grandes franchises à exclure (insensible à la casse)
const FRANCHISE_BLACKLIST = [
  'saint algue', 'franck provost', 'jean-louis david', 'dessange',
  'jacques dessange', 'camille albane', 'toni&guy', 'toni & guy',
  'l\'oréal', 'great lengths', 'hair success',
];

/**
 * Recherche les salons autour d'un point GPS via Nearby Search + Text Search.
 * Déduplique par place_id avant de retourner.
 */
export async function searchSalons({ lat, lng, radius }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const seen = new Map();

  // 1. Nearby Search par type
  for (const type of PLACE_TYPES) {
    const results = await nearbySearch({ lat, lng, radius, type, apiKey });
    for (const p of results) seen.set(p.place_id, p);
  }

  // 2. Text Search par mot-clé pour compléter
  for (const query of SEARCH_QUERIES) {
    const results = await textSearch({ lat, lng, radius, query, apiKey });
    for (const p of results) seen.set(p.place_id, p);
  }

  return [...seen.values()];
}

async function nearbySearch({ lat, lng, radius, type, apiKey }) {
  const results = [];
  let pageToken = null;

  do {
    const params = {
      location: `${lat},${lng}`,
      radius,
      type,
      key: apiKey,
      language: 'fr',
    };
    if (pageToken) params.pagetoken = pageToken;

    // Google exige un délai entre les pages
    if (pageToken) await sleep(2000);

    const { data } = await axios.get(`${PLACES_BASE}/nearbysearch/json`, { params });

    if (!['OK', 'ZERO_RESULTS'].includes(data.status)) {
      console.warn(`  [NearbySearch] Statut inattendu: ${data.status}`);
      break;
    }

    results.push(...(data.results || []));
    pageToken = data.next_page_token || null;
  } while (pageToken && results.length < parseInt(process.env.MAX_RESULTS || '60'));

  return results;
}

async function textSearch({ lat, lng, radius, query, apiKey }) {
  const results = [];
  let pageToken = null;

  do {
    const params = {
      query,
      location: `${lat},${lng}`,
      radius,
      key: apiKey,
      language: 'fr',
    };
    if (pageToken) params.pagetoken = pageToken;

    if (pageToken) await sleep(2000);

    const { data } = await axios.get(`${PLACES_BASE}/textsearch/json`, { params });

    if (!['OK', 'ZERO_RESULTS'].includes(data.status)) {
      console.warn(`  [TextSearch "${query}"] Statut inattendu: ${data.status}`);
      break;
    }

    results.push(...(data.results || []));
    pageToken = data.next_page_token || null;
  } while (pageToken && results.length < 20);

  return results;
}

/**
 * Récupère les détails complets d'un lieu (website, phone, etc.)
 */
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

/**
 * Calcule la distance en mètres entre deux points GPS (Haversine).
 */
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
