// Chain / franchise detection: businesses that operate as part of a national
// or international network almost always already have a website and a
// marketing budget, so they are excluded from prospecting entirely rather
// than just scored lower (mirrors the halal exclusion in filters.ts, which
// uses the same "exclude, don't deprioritize" approach).
//
// Detection combines independent signals rather than relying only on a
// static list, so brands not yet catalogued are still caught:
//   1. A curated list of well-known chains (fast, zero false negatives for
//      the brands everyone recognizes).
//   2. Generic franchise-naming patterns (explicit "franchise"/network
//      wording) that catch brands not in the list.
//   3. Same-name duplicate detection across a single search batch: if two or
//      more distinct locations in the same area share a normalized name,
//      that alone is proof of a chain — no list needed.

const CHAIN_NAME_BLACKLIST = [
  // Grande distribution / supermarchés
  'carrefour', 'auchan', 'leclerc', 'e.leclerc', 'intermarché', 'intermarche',
  'lidl', 'aldi', 'monoprix', 'franprix', 'casino', 'super u', 'hyper u',
  'u express', 'système u', 'systeme u', 'cora', 'match', 'leader price',
  'grand frais', 'picard', 'biocoop', 'naturalia', 'spar', 'proxi', 'netto',
  'action', 'noz',

  // Bricolage / jardinage / équipement maison
  'castorama', 'leroy merlin', 'brico dépôt', 'brico depot', 'bricomarché',
  'bricomarche', 'bricorama', 'weldom', 'mr bricolage', 'ikea', 'but',
  'conforama', 'maisons du monde', 'gifi', 'centrakor',

  // Sport / mode / beauté
  'decathlon', 'go sport', 'intersport', 'zara', 'h&m', 'primark', 'kiabi',
  'celio', 'jules', 'undiz', 'sephora', 'marionnaud', 'nocibé', 'nocibe',
  'yves rocher', 'the body shop',

  // Restauration rapide / café
  'mcdonald', 'burger king', 'kfc', 'subway', 'quick', 'starbucks',
  'columbus café', 'columbus cafe', 'paul', 'brioche dorée', 'brioche doree',
  "domino's", 'dominos pizza', 'pizza hut', 'five guys', "o'tacos",
  'pomme de pain', 'la mie câline', 'la mie caline', 'class croute',
  "class'croute", 'exki', 'prêt à manger', 'pret a manger',

  // Coiffure (réseaux nationaux)
  'saint algue', 'franck provost', 'jean-louis david', 'dessange',
  'jacques dessange', 'camille albane', 'toni&guy', 'toni & guy',
  "l'oréal", 'great lengths', 'hair success',

  // Télécom / banque / services financiers / courrier
  'orange', 'sfr', 'bouygues telecom', 'free mobile', 'boulanger',
  'bnp paribas', 'société générale', 'societe generale', 'crédit agricole',
  'credit agricole', 'crédit mutuel', 'credit mutuel', 'la banque postale',
  "caisse d'épargne", "caisse d'epargne", 'lcl', 'la poste',

  // Transport / mobilité / auto
  'sncf', 'norauto', 'feu vert', 'midas', 'speedy', 'euromaster', 'point s',
  'vulco', 'avis', 'europcar', 'hertz', 'sixt',

  // Immobilier (réseaux d'agences nationaux)
  'century 21', 'orpi', 'laforêt', 'laforet', 'guy hoquet', 'stéphane plaza',
  'stephane plaza',
];

// Names that only ever appear as a chain's own outlet-naming convention,
// regardless of which specific brand — catches chains not (yet) in the
// curated list above.
const FRANCHISE_NAMING_PATTERNS = [
  /\bfranchisé?e?\b/i,
  /\bfranchise\b/i,
  /\bréseau\s+(national|de\s+franchisés?)\b/i,
];

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isKnownChainName(name: string): boolean {
  const normalized = normalizeName(name);
  if (!normalized) return false;
  return CHAIN_NAME_BLACKLIST.some(brand => normalized.includes(normalizeName(brand)));
}

export function matchesFranchiseNamingPattern(name: string): boolean {
  return FRANCHISE_NAMING_PATTERNS.some(pattern => pattern.test(name || ''));
}

export function isFranchise(name: string): boolean {
  return isKnownChainName(name) || matchesFranchiseNamingPattern(name);
}

export interface DuplicateCheckable {
  name?: string;
  place_id: string;
}

// Same normalized name found at 2+ distinct place_ids within one search
// batch is itself proof of a chain — an independent business doesn't have
// branches. Catches chains the static list has never heard of.
export function findDuplicateChainNames<T extends DuplicateCheckable>(places: T[]): Set<string> {
  const idsByName = new Map<string, Set<string>>();
  for (const place of places) {
    const normalized = normalizeName(place.name ?? '');
    if (!normalized) continue;
    if (!idsByName.has(normalized)) idsByName.set(normalized, new Set());
    idsByName.get(normalized)!.add(place.place_id);
  }

  const duplicated = new Set<string>();
  for (const [name, ids] of idsByName) {
    if (ids.size >= 2) duplicated.add(name);
  }
  return duplicated;
}

// Combined batch-level filter: static/pattern blacklist + duplicate-branch
// detection. Use this wherever a full batch of distinct locations is
// available (before per-place Details calls); use isFranchise() alone for
// single-place checks.
export function filterOutChains<T extends DuplicateCheckable>(places: T[]): T[] {
  const duplicateNames = findDuplicateChainNames(places);
  return places.filter(place => {
    if (isFranchise(place.name ?? '')) return false;
    if (duplicateNames.has(normalizeName(place.name ?? ''))) return false;
    return true;
  });
}
