import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

app.use(cors());
app.use(express.json());

// ─── Google Places ────────────────────────────────────────────────────────────

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function geocode(location) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Geocoding failed for: ${location}`);
  return data.results[0].geometry.location; // { lat, lng }
}

async function nearbySearch(lat, lng, pageToken = null) {
  let url;
  if (pageToken) {
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${encodeURIComponent(pageToken)}&key=${GOOGLE_API_KEY}`;
  } else {
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&keyword=barber%20salon%20hair&key=${GOOGLE_API_KEY}`;
  }
  const res = await fetch(url);
  const data = await res.json();
  return { results: data.results ?? [], nextPageToken: data.next_page_token ?? null };
}

async function placeDetails(placeId) {
  const fields = 'name,formatted_address,rating,user_ratings_total,website,url,geometry';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result ?? {};
}

function detectPlatforms(website) {
  if (!website) return [];
  const url = website.toLowerCase();
  const platforms = [];
  if (url.includes('planity')) platforms.push('Planity');
  if (url.includes('booksy')) platforms.push('Booksy');
  if (url.includes('instagram')) platforms.push('Instagram');
  return platforms;
}

async function enrichPlaces(places, lat, lng) {
  return Promise.all(
    places.map(async (place) => {
      const details = await placeDetails(place.place_id);

      const website = details.website ?? null;
      const platforms = detectPlatforms(website);
      const name = details.name ?? place.name;
      const address = details.formatted_address ?? place.vicinity ?? '';
      const rating = details.rating ?? place.rating ?? 0;
      const reviews = details.user_ratings_total ?? place.user_ratings_total ?? 0;
      const googleMapsUrl = details.url ?? `https://maps.google.com/?q=${encodeURIComponent(name)}`;

      const placeLat = details.geometry?.location?.lat ?? place.geometry?.location?.lat ?? null;
      const placeLng = details.geometry?.location?.lng ?? place.geometry?.location?.lng ?? null;
      const distance = (placeLat != null && placeLng != null && lat != null && lng != null)
        ? haversineDistance(lat, lng, placeLat, placeLng)
        : null;

      const salon = { name, address, rating, reviews, website, platforms, googleMapsUrl, distance };
      return { ...salon, score: computeScore(salon) };
    })
  );
}

async function getGooglePlacesResults(location, searchLat = null, searchLng = null) {
  let lat, lng;

  if (searchLat != null && searchLng != null) {
    lat = searchLat;
    lng = searchLng;
  } else {
    ({ lat, lng } = await geocode(location));
  }

  let allPlaces = [];
  let { results: places, nextPageToken } = await nearbySearch(lat, lng);
  allPlaces = allPlaces.concat(places);

  while (nextPageToken) {
    await new Promise(r => setTimeout(r, 2000));
    const next = await nearbySearch(null, null, nextPageToken);
    allPlaces = allPlaces.concat(next.results);
    nextPageToken = next.nextPageToken;
  }

  const results = await enrichPlaces(allPlaces, lat, lng);
  return results;
}

// ─── Scoring (logique inchangée) ──────────────────────────────────────────────

function computeScore(salon) {
  let score = 0;

  if (!salon.website) {
    score += 40;
  } else if (salon.platforms.length > 0) {
    score += 25;
  }

  if (salon.reviews >= 100) score += 20;
  else if (salon.reviews >= 30) score += 12;
  else if (salon.reviews >= 10) score += 6;
  else score += 2;

  if (salon.rating >= 4.5) score += 10;
  else if (salon.rating >= 4.0) score += 7;
  else if (salon.rating >= 3.5) score += 3;

  return Math.min(score, 100);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

function sortResults(results) {
  return results.sort((a, b) => {
    const aNoSite = !a.website ? 0 : 1;
    const bNoSite = !b.website ? 0 : 1;
    if (aNoSite !== bNoSite) return aNoSite - bNoSite;
    if (b.score !== a.score) return b.score - a.score;
    const aDist = a.distance ?? Infinity;
    const bDist = b.distance ?? Infinity;
    return aDist - bDist;
  });
}

app.post('/search', async (req, res) => {
  const { location, lat, lng } = req.body;

  if (!location || !location.trim()) {
    return res.status(400).json({ error: 'location requis' });
  }

  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY manquante dans .env' });
  }

  try {
    const results = await getGooglePlacesResults(
      location.trim(),
      typeof lat === 'number' ? lat : null,
      typeof lng === 'number' ? lng : null
    );
    res.json({ results: sortResults(results) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Prospectly backend → http://localhost:${PORT}`);
});
