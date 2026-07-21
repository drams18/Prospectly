const BOOKING_PLATFORMS = ['planity', 'fresha', 'treatwell', 'resalib', 'calendly'];

export interface BookingResult {
  hasBooking: boolean;
  bookingType: 'none' | 'unknown' | 'external';
}

export function detectBooking(website?: string | null): BookingResult {
  if (!website) return { hasBooking: false, bookingType: 'none' };
  const url = website.toLowerCase();
  const match = BOOKING_PLATFORMS.find(p => url.includes(p));
  if (match) return { hasBooking: true, bookingType: 'external' };
  return { hasBooking: false, bookingType: 'unknown' };
}

export function detectInstagram(website?: string | null): boolean {
  if (!website) return false;
  return website.toLowerCase().includes('instagram.com');
}

export interface ScorableLead {
  website?: string | null;
  hasBooking?: boolean;
  rating?: number | null;
  reviews?: number | null;
  types?: string[] | null;
  phone?: string | null;
  address?: string | null;
  photos?: string[] | null;
  openingHours?: unknown | null;
}

// Google Places types typical of artisans, liberal professions and
// service-based independents — the profile prospecting should favor.
const INDEPENDENT_SERVICE_TYPES = [
  'hair_care', 'beauty_salon', 'spa', 'car_repair', 'doctor', 'dentist',
  'lawyer', 'accounting', 'plumber', 'electrician', 'locksmith',
  'real_estate_agency', 'insurance_agency', 'physiotherapist',
  'veterinary_care', 'bakery', 'butcher_shop', 'florist', 'restaurant',
  'cafe',
];

export interface ScoreRule {
  id: string;
  points: number;
  test: (lead: ScorableLead) => boolean;
}

// Additive, independently-testable scoring signals. Add a new prospecting
// criterion by appending a rule here — computeScore() and the sum/clamp
// logic never need to change. Summed then clamped to [0, 100].
export const SCORE_RULES: ScoreRule[] = [
  { id: 'no-website', points: 45, test: l => !l.website },
  { id: 'no-booking', points: 30, test: l => !l.hasBooking },
  // "Établissement récent" has no reliable signal in the Places API (no
  // founding-date field) — a low review count is used as its proxy instead.
  { id: 'low-review-volume', points: 10, test: l => (l.reviews ?? 0) < 10 },
  { id: 'incomplete-profile', points: 10, test: l => !l.phone || !l.address || !l.openingHours },
  { id: 'few-photos', points: 5, test: l => (l.photos?.length ?? 0) < 3 },
  { id: 'independent-service-activity', points: 10, test: l => (l.types ?? []).some(t => INDEPENDENT_SERVICE_TYPES.includes(t)) },
  { id: 'decent-rating', points: 15, test: l => (l.rating ?? 0) >= 4 },
  { id: 'established-reviews', points: 15, test: l => (l.reviews ?? 0) >= 20 },
  { id: 'already-well-known', points: -25, test: l => (l.reviews ?? 0) >= 1000 },
  { id: 'website-and-booking-already-optimized', points: -30, test: l => !!l.website && !!l.hasBooking },
];

export function computeScore(lead: ScorableLead): number {
  const total = SCORE_RULES.reduce((sum, rule) => sum + (rule.test(lead) ? rule.points : 0), 0);
  return Math.max(0, Math.min(100, Math.round(total)));
}

export function getScoreLabel(score: number): 'hot' | 'medium' | 'low' {
  if (score >= 80) return 'hot';
  if (score >= 50) return 'medium';
  return 'low';
}

export interface FlaggableLead extends ScorableLead {
  hasInstagram?: boolean;
}

export interface LeadFlags {
  isHot: boolean;
  wastedPotential: boolean;
  instaDependent: boolean;
}

export function computeFlags(prospect: FlaggableLead): LeadFlags {
  const { website, hasBooking, rating, reviews, hasInstagram } = prospect;
  return {
    isHot: (!website || !hasBooking) && (rating ?? 0) >= 4 && (reviews ?? 0) >= 20,
    wastedPotential: !!website && !hasBooking && (reviews ?? 0) >= 30,
    instaDependent: !website && !!hasInstagram && !hasBooking,
  };
}

export interface SearchFilters {
  hasWebsite?: boolean;
  hasBooking?: boolean;
  minRating?: number;
  minReviews?: number;
  category?: string;
  onlyHot?: boolean;
}

export interface OpeningHours {
  openNow: boolean | null;
  weekdayText: string[];
}

export interface ScoredLead extends LeadFlags {
  placeId: string;
  name: string;
  category: string | null;
  types: string[];
  address: string;
  phone: string | null;
  rating: number | null;
  reviews: number;
  website: string | null;
  hasWebsite: boolean;
  hasBooking: boolean;
  bookingType: 'none' | 'unknown' | 'external';
  hasInstagram: boolean;
  googleMapsUrl: string;
  imageUrl: string | null;
  photos: string[];
  openingHours: OpeningHours | null;
  lat: number | null;
  lng: number | null;
  distance: number | null;
  score: number;
  scoreLabel: 'hot' | 'medium' | 'low';
}

export function applySearchFilters(results: ScoredLead[], filters: SearchFilters = {}): ScoredLead[] {
  const { hasWebsite, hasBooking, minRating = 0, minReviews = 0, category, onlyHot } = filters;
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

export function sortResults(results: ScoredLead[]): ScoredLead[] {
  return [...results].sort((a, b) => {
    const hotDiff = (b.isHot ? 1 : 0) - (a.isHot ? 1 : 0);
    if (hotDiff !== 0) return hotDiff;
    if (b.score !== a.score) return b.score - a.score;
    if ((b.reviews ?? 0) !== (a.reviews ?? 0)) return (b.reviews ?? 0) - (a.reviews ?? 0);
    return (a.distance ?? Infinity) - (b.distance ?? Infinity);
  });
}
