export const CATEGORY_GROUPS = [
  {
    id: 'beaute',
    label: 'BEAUTÉ',
    categories: [
      { id: 'barbier',    label: 'Barbier',    keywords: ['barbier', 'barber', 'barbershop'] },
      { id: 'coiffeur',   label: 'Coiffeur',   keywords: ['coiffeur', 'salon de coiffure'] },
      { id: 'onglerie',   label: 'Onglerie',   keywords: ['onglerie', 'nail salon', 'manucure'] },
      { id: 'esthetique', label: 'Esthétique', keywords: ['institut de beauté', 'esthétique', 'spa'] },
    ],
  },
  {
    id: 'restauration',
    label: 'RESTAURATION',
    categories: [
      { id: 'restaurant', label: 'Restaurant', keywords: ['restaurant', 'brasserie', 'bistrot'] },
      { id: 'fastfood',   label: 'Fast food',  keywords: ['fast food', 'snack', 'kebab'] },
      { id: 'cafe',       label: 'Café',       keywords: ['café', 'coffee shop', 'salon de thé'] },
    ],
  },
  {
    id: 'services',
    label: 'SERVICES',
    categories: [
      { id: 'garage',      label: 'Garage',      keywords: ['garage auto', 'mécanique auto', 'carrosserie'] },
      { id: 'plombier',    label: 'Plombier',    keywords: ['plombier'] },
      { id: 'electricien', label: 'Électricien', keywords: ['électricien'] },
    ],
  },
  {
    id: 'commerce',
    label: 'COMMERCE',
    categories: [
      { id: 'boulangerie', label: 'Boulangerie', keywords: ['boulangerie', 'pâtisserie'] },
      { id: 'boucherie',   label: 'Boucherie',   keywords: ['boucherie', 'charcuterie'] },
      { id: 'fleuriste',   label: 'Fleuriste',   keywords: ['fleuriste'] },
    ],
  },
];

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORY_GROUPS.flatMap(g => g.categories.map(c => [c.id, c]))
);
