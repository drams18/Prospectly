const BOOKING_PLATFORMS = ['planity', 'fresha', 'treatwell', 'resalib', 'calendly'];

export function detectBooking(website) {
  if (!website) return { hasBooking: false, bookingType: 'none' };
  const url = website.toLowerCase();
  const match = BOOKING_PLATFORMS.find(p => url.includes(p));
  if (match) return { hasBooking: true, bookingType: 'external' };
  return { hasBooking: false, bookingType: 'unknown' };
}

export function detectInstagram(website) {
  if (!website) return false;
  return website.toLowerCase().includes('instagram.com');
}

export function computeScore(prospect) {
  let score = 0;
  if (!prospect.website) score += 60;
  if (!prospect.hasBooking) score += 40;
  if ((prospect.rating ?? 0) >= 4) score += 20;
  if ((prospect.reviews ?? 0) >= 20) score += 20;
  if (prospect.website && prospect.hasBooking) score -= 30;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getScoreLabel(score) {
  if (score >= 80) return 'hot';
  if (score >= 50) return 'medium';
  return 'low';
}

export function computeFlags(prospect) {
  const { website, hasBooking, rating, reviews, hasInstagram } = prospect;
  return {
    isHot: (!website || !hasBooking) && (rating ?? 0) >= 4 && (reviews ?? 0) >= 20,
    wastedPotential: !!website && !hasBooking && (reviews ?? 0) >= 30,
    instaDependent: !website && !!hasInstagram && !hasBooking,
  };
}

export function applySearchFilters(results, filters = {}) {
  const { hasWebsite, hasBooking, minRating, minReviews, category, onlyHot } = filters;
  return results.filter(r => {
    if (hasWebsite === false && r.website) return false;
    if (hasWebsite === true && !r.website) return false;
    if (hasBooking === false && r.hasBooking) return false;
    if (hasBooking === true && !r.hasBooking) return false;
    if (minRating > 0 && (r.rating ?? 0) < minRating) return false;
    if (minReviews > 0 && (r.reviews ?? 0) < minReviews) return false;
    if (category && !r.name?.toLowerCase().includes(category.toLowerCase())) return false;
    if (onlyHot && !r.isHot) return false;
    return true;
  });
}

export function sortResults(results) {
  return [...results].sort((a, b) => {
    const hotDiff = (b.isHot ? 1 : 0) - (a.isHot ? 1 : 0);
    if (hotDiff !== 0) return hotDiff;
    if (b.score !== a.score) return b.score - a.score;
    if ((b.reviews ?? 0) !== (a.reviews ?? 0)) return (b.reviews ?? 0) - (a.reviews ?? 0);
    return (a.distance ?? Infinity) - (b.distance ?? Infinity);
  });
}
