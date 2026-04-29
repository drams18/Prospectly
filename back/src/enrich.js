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
 * @returns {{
 * hasSite, isOwnSite, platforms, websiteUrl, isBadSite, badSiteReasons,
 * responseTime, hasHttps, hasMetaTitle, hasViewport, mobileReachable, siteHealth, siteQuality
 * }}
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
    hasHttps: false,
    hasMetaTitle: false,
    hasViewport: false,
    mobileReachable: false,
    siteHealth: 'none',
    siteQuality: 'none',
  };

  if (!websiteUrl) return empty;

  // Detect booking platforms
  const bookingMatches = BOOKING_PLATFORMS.filter(p => p.pattern.test(websiteUrl)).map(p => p.name);
  if (bookingMatches.length) {
    return { ...empty, hasSite: true, isOwnSite: false, platforms: bookingMatches, websiteUrl, siteHealth: 'correct', siteQuality: 'modern' };
  }

  // Detect social media (only social = no own site)
  const socialMatches = SOCIAL_PLATFORMS.filter(p => p.pattern.test(websiteUrl)).map(p => p.name);
  if (socialMatches.length) {
    return { ...empty, hasSite: true, isOwnSite: false, platforms: socialMatches, websiteUrl, siteHealth: 'improvable', siteQuality: 'basic' };
  }

  // Detect directories
  if (DIRECTORY_PATTERNS.some(p => p.test(websiteUrl))) {
    return { ...empty, hasSite: true, isOwnSite: false, platforms: ['Annuaire'], websiteUrl, siteHealth: 'improvable', siteQuality: 'basic' };
  }

  // Own site — fetch and analyze quality
  const badSiteReasons = [];
  let responseTime = null;
  const hasHttps = websiteUrl.startsWith('https://');
  let hasMetaTitle = false;
  let hasViewport = false;
  let mobileReachable = false;

  if (!hasHttps) {
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

    hasMetaTitle = !!$('title').text().trim();
    hasViewport = $('meta[name="viewport"]').length > 0;
    if (!hasMetaTitle) {
      badSiteReasons.push('No title');
    }

    if (!$('meta[name="description"]').attr('content')) {
      badSiteReasons.push('No meta description');
    }

    if (!hasViewport) {
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

  try {
    const mobileResponse = await axios.get(websiteUrl, {
      timeout: 3000,
      maxRedirects: 3,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' },
      validateStatus: () => true,
    });
    mobileReachable = mobileResponse.status < 400;
    if (!mobileReachable) badSiteReasons.push('Mobile HTTP error');
  } catch {
    badSiteReasons.push('Mobile unreachable');
  }

  const siteHealth = getSiteHealth({ badSiteReasons, hasHttps, hasMetaTitle, responseTime, hasViewport, mobileReachable });
  const siteQuality = siteHealth === 'correct' ? 'modern' : siteHealth === 'improvable' ? 'basic' : 'weak';

  return {
    hasSite: true,
    isOwnSite: true,
    platforms: [],
    websiteUrl,
    isBadSite: badSiteReasons.length > 0,
    badSiteReasons,
    responseTime,
    hasHttps,
    hasMetaTitle,
    hasViewport,
    mobileReachable,
    siteHealth,
    siteQuality,
  };
}

function getSiteHealth({ badSiteReasons, hasHttps, hasMetaTitle, responseTime, hasViewport, mobileReachable }) {
  const hasHardFailure = badSiteReasons.includes('Unreachable') || badSiteReasons.includes('HTTP error') || badSiteReasons.includes('Coming soon');
  if (hasHardFailure) return 'weak';

  const weakSignals = [!hasHttps, !hasMetaTitle, !hasViewport, !mobileReachable, (responseTime ?? 0) > 2200].filter(Boolean).length;
  if (weakSignals >= 2) return 'weak';
  if (weakSignals === 1) return 'improvable';
  return 'correct';
}
