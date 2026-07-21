export interface Category {
  id: string;
  label: string;
  keywords: string[];
}

export interface CategoryGroup {
  id: string;
  label: string;
  categories: Category[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'beaute', label: 'BEAUTÉ',
    categories: [
      { id: 'barbier',    label: 'Barbier',    keywords: ['barbier', 'barber', 'barbershop'] },
      { id: 'coiffeur',   label: 'Coiffeur',   keywords: ['coiffeur', 'salon de coiffure'] },
      { id: 'onglerie',   label: 'Onglerie',   keywords: ['onglerie', 'nail salon', 'manucure'] },
      { id: 'esthetique', label: 'Esthétique', keywords: ['institut de beauté', 'esthétique', 'spa'] },
    ],
  },
  {
    id: 'restauration', label: 'RESTAURATION',
    categories: [
      { id: 'restaurant', label: 'Restaurant', keywords: ['restaurant', 'brasserie', 'bistrot'] },
      { id: 'fastfood',   label: 'Fast food',  keywords: ['fast food', 'snack', 'kebab'] },
      { id: 'cafe',       label: 'Café',       keywords: ['café', 'coffee shop', 'salon de thé'] },
    ],
  },
  {
    id: 'services', label: 'SERVICES',
    categories: [
      { id: 'garage',      label: 'Garage',      keywords: ['garage auto', 'mécanique auto', 'carrosserie'] },
      { id: 'plombier',    label: 'Plombier',    keywords: ['plombier'] },
      { id: 'electricien', label: 'Électricien', keywords: ['électricien'] },
    ],
  },
  {
    id: 'commerce', label: 'COMMERCE',
    categories: [
      { id: 'boulangerie', label: 'Boulangerie', keywords: ['boulangerie', 'pâtisserie'] },
      { id: 'boucherie',   label: 'Boucherie',   keywords: ['boucherie', 'charcuterie'] },
      { id: 'fleuriste',   label: 'Fleuriste',   keywords: ['fleuriste'] },
    ],
  },
];

export const CATEGORY_MAP: Record<string, Category> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap(g => g.categories.map(c => [c.id, c]))
);

// Google Places type -> French display label, used by the auto-feed where
// there's no user-picked category. Ordered roughly by how likely a type is
// to appear first/meaningfully in a place's `types` array.
const GOOGLE_TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant', bakery: 'Boulangerie', cafe: 'Café', bar: 'Bar',
  meal_takeaway: 'Restauration rapide', meal_delivery: 'Restauration rapide',
  hair_care: 'Coiffure / Barbier', beauty_salon: 'Institut de beauté', spa: 'Spa',
  car_repair: 'Garage automobile', car_dealer: 'Concessionnaire auto', car_wash: 'Lavage auto',
  plumber: 'Plombier', electrician: 'Électricien', locksmith: 'Serrurier',
  doctor: 'Médecin', dentist: 'Dentiste', physiotherapist: 'Kinésithérapeute',
  hospital: 'Centre médical', pharmacy: 'Pharmacie', veterinary_care: 'Vétérinaire',
  lodging: 'Hôtel', real_estate_agency: 'Agence immobilière', insurance_agency: 'Assurance',
  lawyer: 'Avocat', accounting: 'Comptable', bank: 'Banque',
  gym: 'Salle de sport', school: 'École', primary_school: 'École',
  secondary_school: 'École', university: 'École', book_store: 'Librairie',
  clothing_store: 'Boutique de vêtements', shoe_store: 'Magasin de chaussures',
  jewelry_store: 'Bijouterie', florist: 'Fleuriste', furniture_store: 'Magasin de meubles',
  hardware_store: 'Quincaillerie', electronics_store: 'Magasin d’électronique',
  supermarket: 'Supérette', grocery_or_supermarket: 'Épicerie', convenience_store: 'Commerce de proximité',
  butcher_shop: 'Boucherie', store: 'Boutique',
};

export function deriveCategoryLabel(types: string[] = []): string {
  for (const type of types) {
    if (GOOGLE_TYPE_LABELS[type]) return GOOGLE_TYPE_LABELS[type];
  }
  const fallback = types.find(t => !['point_of_interest', 'establishment'].includes(t));
  if (!fallback) return 'Commerce';
  return fallback
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
