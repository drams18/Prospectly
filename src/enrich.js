import axios from 'axios';

// Plateformes qui ne constituent PAS un vrai site propriétaire
const PLATFORM_PATTERNS = [
  { name: 'Planity', regex: /planity\.com/i },
  { name: 'Treatwell', regex: /treatwell\.(fr|com|co\.uk)/i },
  { name: 'Booksy', regex: /booksy\.com/i },
  { name: 'Fresha', regex: /fresha\.com/i },
  { name: 'Vagaro', regex: /vagaro\.com/i },
  { name: 'Instagram', regex: /instagram\.com/i },
  { name: 'Facebook', regex: /facebook\.com/i },
  { name: 'Google Maps', regex: /maps\.google|goo\.gl\/maps/i },
  { name: 'Pages Jaunes', regex: /pagesjaunes\.fr/i },
  { name: 'Yelp', regex: /yelp\.(fr|com)/i },
];

/**
 * Analyse l'URL de site web d'un salon.
 * Retourne : { hasSite, isOwnSite, platforms, websiteUrl }
 */
export function analyzeWebsite(websiteUrl) {
  if (!websiteUrl) {
    return { hasSite: false, isOwnSite: false, platforms: [], websiteUrl: null };
  }

  const detectedPlatforms = PLATFORM_PATTERNS
    .filter(({ regex }) => regex.test(websiteUrl))
    .map(({ name }) => name);

  const isOwnSite = detectedPlatforms.length === 0;

  return {
    hasSite: true,
    isOwnSite,
    platforms: detectedPlatforms,
    websiteUrl,
  };
}

/**
 * Enrichissement avancé via Google Custom Search API (optionnel).
 * Cherche le nom du salon sur le web pour détecter présence/absence de site.
 * Respecte un délai entre requêtes pour ne pas saturer le quota (100 req/jour gratuit).
 */
export async function searchWebPresence(salonName, address) {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) return null;

  await sleep(300); // délai poli entre requêtes

  try {
    const query = `"${salonName}" ${extractCity(address)}`;
    const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: { key: apiKey, cx: cseId, q: query, num: 5, hl: 'fr', gl: 'fr' },
      timeout: 8000,
    });

    if (!data.items?.length) return { foundSite: false, platforms: [] };

    const urls = data.items.map((item) => item.link);
    const platforms = [];

    for (const url of urls) {
      for (const { name, regex } of PLATFORM_PATTERNS) {
        if (regex.test(url) && !platforms.includes(name)) platforms.push(name);
      }
    }

    // Un vrai site = au moins un résultat qui n'est pas une plateforme
    const hasOwnSite = urls.some(
      (url) => !PLATFORM_PATTERNS.some(({ regex }) => regex.test(url))
    );

    return { foundSite: hasOwnSite, platforms, urls };
  } catch {
    return null;
  }
}

function extractCity(address) {
  // Extrait le code postal ou la ville depuis une adresse française
  const match = address?.match(/\b(75\d{3}|Paris|Lyon|Marseille)\b/i);
  return match ? match[0] : 'Paris';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
