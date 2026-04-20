import axios from 'axios';

/**
 * Convertit une adresse textuelle en coordonnées GPS via Google Geocoding API.
 * @param {string} address - Ex: "Paris 18", "Rue de la Goutte d'Or, Paris"
 * @returns {Promise<{lat: number, lng: number, formatted: string}>}
 */
export async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = 'https://maps.googleapis.com/maps/api/geocode/json';

  const { data } = await axios.get(url, {
    params: {
      address: `${address}, France`,
      key: apiKey,
      language: 'fr',
    },
  });

  if (data.status !== 'OK' || !data.results.length) {
    throw new Error(`Géocodage échoué pour "${address}": ${data.status}`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  const formatted = data.results[0].formatted_address;

  return { lat, lng, formatted };
}
