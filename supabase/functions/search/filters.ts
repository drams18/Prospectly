// Central "is this business worth showing at all" gate. Everything here is
// expressed as a list of small, independently-testable exclusion rules
// (see EXCLUSION_RULES at the bottom) so new criteria can be added by
// appending a rule object — no other code needs to change.
import { isFranchise } from './chains.ts';

export interface PlaceContext {
  name?: string;
  types?: string[];
}

export interface ExclusionRule {
  id: string;
  reason: string;
  test: (place: PlaceContext) => boolean;
}

// ─── Halal filter ──────────────────────────────────────────────────────────
// Google Places types that are real, official legacy-API type values among
// the businesses we must exclude. Everything else below has no Google type
// equivalent and can only be caught by name.
const HARAM_TYPES = ['bar', 'casino', 'liquor_store', 'night_club'];

// Unambiguous concepts with no legitimate business naming overlap — safe to
// match on name regardless of what `types` says.
const HARAM_NAME_PATTERNS_ALWAYS: RegExp[] = [
  /tabac(?!ulaire)/i, // "bureau de tabac", "tabac presse" — excludes "tabaculaire" false positive
  /\bvape\b|\bvaping\b|cigarette\s*électronique/i,
  /\bcannabis\b|\bcbd\b/i,
  /paris\s*sportifs?|\bpmu\b|\bbetting\b/i,
  /libertin|érotique|erotique|\bsex[\s-]*shop\b|strip[\s-]*tease|strip[\s-]*club/i,
  /\bcaviste\b/i,
  /wine\s*bar|bar\s*à\s*vin/i,
  /\bcasino\b/i,
  // Alcohol-focused venues that a generic "brasserie"/"bar" pattern would
  // miss or wrongly over-catch (plain "brasserie" is also common French for
  // an ordinary restaurant, so only the explicit alcohol-oriented phrasing
  // is treated as unambiguous).
  /micro-?brasserie|brasserie\s*artisanale|craft\s*beer|cave\s*à\s*bi[eè]re|\bspiritueux\b/i,
];

// Genuinely ambiguous bare words (real French naming conventions like "Bar
// à Salades", "Ongle Bar" would false-positive here) — only checked when
// Google gives us no `types` to rely on instead.
const HARAM_NAME_PATTERNS_FALLBACK: RegExp[] = [
  /(?<![a-z])bar(?![a-z])/i,
  /(?<![a-z])pub(?![a-z])/i,
];

// Deliberately low-recall: most pork specialists don't spell it out in the
// name, but per the "when in doubt, keep it" rule for genuinely ambiguous
// cases, we only exclude on an explicit, unambiguous signal rather than
// guessing from a generic "boucherie".
const PORK_SPECIALTY_PATTERN = /(boucherie|charcuterie)[^.]*\b(porc|porcin|cochon)\b|\b(porc|porcin|cochon)\b[^.]*(boucherie|charcuterie)/i;

// ─── Non-prospect institutions ─────────────────────────────────────────────
// Public/administrative/tourism/transport infrastructure: never a sales
// prospect. Also doubles as noise protection against a type-bucket fan-out
// picking up e.g. a metro entrance tagged `point_of_interest` alongside
// `transit_station` via secondary types.
const NON_PROSPECT_TYPES = [
  // Administration / gouvernement / services publics
  'city_hall', 'local_government_office', 'courthouse', 'embassy',
  'fire_station', 'police', 'post_office',
  // Tourisme / patrimoine
  'museum', 'tourist_attraction',
  // Transport
  'transit_station', 'bus_station', 'subway_station', 'train_station',
  'light_rail_station', 'airport', 'parking',
  // Espaces publics
  'park', 'cemetery', 'stadium',
  // Éducation / santé publiques (les praticiens indépendants — 'doctor',
  // 'dentist', 'physiotherapist' — restent des prospects et ne sont pas ici).
  // Le type générique 'school' est volontairement absent : Google l'utilise
  // aussi bien pour un collège public que pour une école privée, un centre
  // de formation ou une école de musique/langues (catégories Éducation du
  // filtre) — seuls les sous-types clairement publics restent exclus.
  'primary_school', 'secondary_school', 'university', 'hospital',
  // Lieux de culte
  'place_of_worship', 'church', 'synagogue', 'hindu_temple', 'mosque',
  // Géographie générique (bruit de géocodage plutôt que des commerces)
  'political', 'locality', 'route',
  'administrative_area_level_1', 'administrative_area_level_2',
];

// ─── Rule engine ────────────────────────────────────────────────────────────
// Ordered roughly cheapest-first; the list is exhaustively checked (no
// short-circuit priority needed since every rule is O(1)/O(patterns)).
export const EXCLUSION_RULES: ExclusionRule[] = [
  {
    id: 'chain-or-franchise',
    reason: 'Grande enseigne / franchise nationale ou internationale',
    test: place => isFranchise(place.name ?? ''),
  },
  {
    id: 'halal-type',
    reason: "Type Google Places lié à l'alcool, aux jeux d'argent ou au tabac",
    test: place => (place.types ?? []).some(t => HARAM_TYPES.includes(t)),
  },
  {
    id: 'halal-name-always',
    reason: 'Nom indiquant sans ambiguïté une activité interdite',
    test: place => HARAM_NAME_PATTERNS_ALWAYS.some(p => p.test(place.name ?? '')),
  },
  {
    id: 'pork-specialty',
    reason: 'Spécialiste porc explicite',
    test: place => PORK_SPECIALTY_PATTERN.test(place.name ?? ''),
  },
  {
    id: 'halal-name-fallback',
    reason: 'Nom ambigu (bar/pub) sans type Google pour trancher — exclu par prudence',
    test: place => {
      const types = place.types ?? [];
      return types.length === 0 && HARAM_NAME_PATTERNS_FALLBACK.some(p => p.test(place.name ?? ''));
    },
  },
  {
    id: 'non-prospect-type',
    reason: 'Bâtiment public, institution ou infrastructure — jamais un prospect commercial',
    test: place => (place.types ?? []).some(t => NON_PROSPECT_TYPES.includes(t)),
  },
];

export function isAllowedBusiness(place: PlaceContext): boolean {
  return !EXCLUSION_RULES.some(rule => rule.test(place));
}

export function isNoiseType(types: string[] = []): boolean {
  if (types.length === 0) return false;
  const meaningfulTypes = types.filter(t => !['point_of_interest', 'establishment'].includes(t));
  if (meaningfulTypes.length === 0) return false;
  return meaningfulTypes.every(t => NON_PROSPECT_TYPES.includes(t));
}
