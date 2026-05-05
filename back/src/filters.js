export const HARAM_CATEGORIES = [
  'bar', 'pub', 'wine_bar', 'nightclub', 'liquor_store',
  'casino', 'gambling', 'betting', 'sex_shop', 'strip_club',
];

// Used only as fallback when Google Places types are absent
const HARAM_NAME_PATTERNS = [
  /(?<![a-z])bar(?![a-z])/i,
  /(?<![a-z])pub(?![a-z])/i,
  /alcohol/i,
  /wine\s*bar/i,
  /casino/i,
  /nightclub/i,
  /strip\s*club/i,
];

export function isAllowedBusiness(place) {
  const types = Array.isArray(place.types) && place.types.length > 0 ? place.types : null;

  if (types) {
    return !types.some(t => HARAM_CATEGORIES.includes(t));
  }

  // Fallback: name matching only when types absent
  const name = place.name || '';
  return !HARAM_NAME_PATTERNS.some(pattern => pattern.test(name));
}
