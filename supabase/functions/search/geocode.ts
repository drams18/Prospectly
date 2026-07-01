export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
}

export async function geocodeAddress(address: string, apiKey: string): Promise<GeocodeResult> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', `${address}, France`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('language', 'fr');

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Géocodage échoué pour "${address}": ${data.status}`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  const formatted = data.results[0].formatted_address;

  return { lat, lng, formatted };
}
