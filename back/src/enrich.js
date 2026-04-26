import axios from 'axios';
import * as cheerio from 'cheerio';

const BOOKING_PLATFORMS = [
  { name: 'Planity',   pattern: /planity\.com/i },
  { name: 'Booksy',    pattern: /booksy\.com/i },
  { name: 'Treatwell', pattern: /treatwell\.(fr|com|co\.uk)/i },
  { name: 'Fresha',    pattern: /fresha\.com/i },
  { name: 'Vagaro',    pattern: /vagaro\.com/i },
];

const SOCIAL_PLATFORMS = [
  { name: 'Instagram', pattern: /instagram\.com/i },
  { name: 'Facebook',  pattern: /facebook\.com|fb\.com/i },
];

const DIRECTORY_PATTERNS = [
  /pagesjaunes\.fr/i,
  /yelp\.(fr|com)/i,
  /google\.com\/maps/i,
  /maps\.app\.goo\.gl/i,
];

/**
 * Analyse la présence web d'un établissement.
 * @returns {{ hasSite, isOwnSite, platforms, websiteUrl, isBadSite, badSiteReasons, responseTime }}
 */
export async function analyzeWebsite(websiteUrl) {
  const empty = {
    hasSite: false,
    isOwnSite: false,
    platforms: [],
    websiteUrl: null,
    isBadSite: false,
    badSiteReasons: [],
    responseTime: null,
  };

  if (!websiteUrl) return empty;

  // Detect booking platforms
  const bookingMatches = BOOKING_PLATFORMS.filter(p => p.pattern.test(websiteUrl)).map(p => p.name);
  if (bookingMatches.length) {
    return { hasSite: true, isOwnSite: false, platforms: bookingMatches, websiteUrl, isBadSite: false, badSiteReasons: [], responseTime: null };
  }

  // Detect social media (only social = no own site)
  const socialMatches = SOCIAL_PLATFORMS.filter(p => p.pattern.test(websiteUrl)).map(p => p.name);
  if (socialMatches.length) {
    return { hasSite: true, isOwnSite: false, platforms: socialMatches, websiteUrl, isBadSite: false, badSiteReasons: [], responseTime: null };
  }

  // Detect directories
  if (DIRECTORY_PATTERNS.some(p => p.test(websiteUrl))) {
    return { hasSite: true, isOwnSite: false, platforms: ['Annuaire'], websiteUrl, isBadSite: false, badSiteReasons: [], responseTime: null };
  }

  // Own site — fetch and analyze quality
  const badSiteReasons = [];
  let responseTime = null;

  if (!websiteUrl.startsWith('https')) {
    badSiteReasons.push('No HTTPS');
  }

  try {
    const start = Date.now();
    const response = await axios.get(websiteUrl, {
      timeout: 3000,
      maxRedirects: 3,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Prospectly/1.0)' },
      validateStatus: () => true,
    });
    responseTime = Date.now() - start;

    if (response.status >= 400) {
      badSiteReasons.push('HTTP error');
    }

    if (responseTime > 3000) {
      badSiteReasons.push('Slow response');
    }

    const html = typeof response.data === 'string' ? response.data : '';
    const $ = cheerio.load(html);

    if (!$('title').text().trim()) {
      badSiteReasons.push('No title');
    }

    if (!$('meta[name="description"]').attr('content')) {
      badSiteReasons.push('No meta description');
    }

    if (!$('meta[name="viewport"]').length) {
      badSiteReasons.push('No viewport');
    }

    const bodyText = $('body').text().toLowerCase();
    if (/coming soon|en construction|bientôt disponible|site en cours/.test(bodyText)) {
      badSiteReasons.push('Coming soon');
    }
  } catch {
    responseTime = 3000;
    badSiteReasons.push('Unreachable');
  }

  return {
    hasSite: true,
    isOwnSite: true,
    platforms: [],
    websiteUrl,
    isBadSite: badSiteReasons.length > 0,
    badSiteReasons,
    responseTime,
  };
}
