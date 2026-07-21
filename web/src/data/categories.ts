export interface Category {
  id: string
  label: string
  // Official Google Place Type (Nearby Search `type=`) when an exact or
  // close-enough broad match exists; null when Google has no matching type,
  // in which case `keywords` (Google's own `keyword=` matching) is used alone.
  type: string | null
  keywords: string[]
}

export interface CategoryGroup {
  id: string
  label: string
  categories: Category[]
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'artisans', label: 'ARTISANS',
    categories: [
      { id: 'plombiers',      label: 'Plombiers',      type: 'plumber',            keywords: ['plombier', 'plomberie'] },
      { id: 'electriciens',   label: 'Électriciens',    type: 'electrician',        keywords: ['électricien', 'électricité'] },
      { id: 'serruriers',     label: 'Serruriers',      type: 'locksmith',          keywords: ['serrurier', 'serrurerie'] },
      { id: 'menuisiers',     label: 'Menuisiers',      type: 'general_contractor', keywords: ['menuisier', 'menuiserie'] },
      { id: 'charpentiers',   label: 'Charpentiers',    type: 'general_contractor', keywords: ['charpentier', 'charpente'] },
      { id: 'couvreurs',      label: 'Couvreurs',       type: 'roofing_contractor', keywords: ['couvreur', 'couverture toiture'] },
      { id: 'macons',         label: 'Maçons',          type: 'general_contractor', keywords: ['maçon', 'maçonnerie'] },
      { id: 'peintres',       label: 'Peintres',        type: 'painter',            keywords: ['peintre en bâtiment'] },
      { id: 'carreleurs',     label: 'Carreleurs',      type: 'general_contractor', keywords: ['carreleur', 'carrelage'] },
      { id: 'facadiers',      label: 'Façadiers',       type: 'general_contractor', keywords: ['façadier', 'ravalement de façade'] },
      { id: 'chauffagistes',  label: 'Chauffagistes',   type: 'general_contractor', keywords: ['chauffagiste', 'chauffage'] },
      { id: 'climatisation',  label: 'Climatisation',   type: 'general_contractor', keywords: ['climatisation', 'installateur climatisation'] },
      { id: 'frigoristes',    label: 'Frigoristes',     type: 'general_contractor', keywords: ['frigoriste'] },
      { id: 'vitriers',       label: 'Vitriers',        type: 'general_contractor', keywords: ['vitrier', 'miroiterie'] },
      { id: 'ramoneurs',      label: 'Ramoneurs',       type: 'general_contractor', keywords: ['ramoneur', 'ramonage'] },
      { id: 'piscinistes',    label: 'Piscinistes',     type: 'general_contractor', keywords: ['pisciniste', 'construction piscine'] },
    ],
  },
  {
    id: 'automobile', label: 'AUTOMOBILE',
    categories: [
      { id: 'garages',            label: 'Garages',                     type: 'car_repair',   keywords: ['garage automobile'] },
      { id: 'carrossiers',        label: 'Carrossiers',                 type: 'car_repair',   keywords: ['carrossier', 'carrosserie'] },
      { id: 'controle_technique', label: 'Centres de contrôle technique', type: null,          keywords: ['contrôle technique automobile'] },
      { id: 'depanneurs',         label: 'Dépanneurs',                  type: null,           keywords: ['dépannage auto', 'remorquage auto'] },
      { id: 'lavages_auto',       label: 'Lavages auto',                type: 'car_wash',     keywords: ['lavage auto', 'station de lavage'] },
      { id: 'reparation_moto',    label: 'Réparation moto',             type: null,           keywords: ['réparation moto', 'garage moto'] },
      { id: 'vente_pneus',        label: 'Vente de pneus',              type: null,           keywords: ['pneus', 'vulcanisateur'] },
      { id: 'reparation_velo',    label: 'Réparation vélo',             type: 'bicycle_store', keywords: ['réparation vélo', 'atelier vélo'] },
    ],
  },
  {
    id: 'alimentation', label: 'ALIMENTATION',
    categories: [
      { id: 'boulangeries',    label: 'Boulangeries',    type: 'bakery', keywords: ['boulangerie'] },
      { id: 'patisseries',     label: 'Pâtisseries',     type: 'bakery', keywords: ['pâtisserie'] },
      { id: 'chocolatiers',    label: 'Chocolatiers',    type: 'food',   keywords: ['chocolatier'] },
      { id: 'traiteurs',       label: 'Traiteurs',       type: 'food',   keywords: ['traiteur'] },
      { id: 'boucheries_halal', label: 'Boucheries halal', type: 'food', keywords: ['boucherie halal'] },
      { id: 'primeurs',        label: 'Primeurs',        type: 'food',   keywords: ['primeur', 'fruits et légumes'] },
      { id: 'epiceries',       label: 'Épiceries',       type: 'food',   keywords: ['épicerie', 'épicerie fine'] },
      { id: 'fromageries',     label: 'Fromageries',     type: 'food',   keywords: ['fromagerie'] },
      { id: 'poissonneries',   label: 'Poissonneries',   type: 'food',   keywords: ['poissonnerie'] },
      { id: 'torrefacteurs',   label: 'Torréfacteurs',   type: 'food',   keywords: ['torréfacteur', 'torréfaction café'] },
    ],
  },
  {
    id: 'beaute', label: 'BEAUTÉ',
    categories: [
      { id: 'coiffeurs',           label: 'Coiffeurs',            type: 'hair_care',    keywords: ['coiffeur', 'salon de coiffure'] },
      { id: 'barbiers',            label: 'Barbiers',             type: 'hair_care',    keywords: ['barbier', 'barbershop'] },
      { id: 'instituts_beaute',    label: 'Instituts de beauté',  type: 'beauty_salon', keywords: ['institut de beauté'] },
      { id: 'ongleries',           label: 'Ongleries',            type: 'beauty_salon', keywords: ['onglerie', 'nail salon', 'manucure'] },
      { id: 'esthetique',          label: 'Esthétique',           type: 'beauty_salon', keywords: ['esthétique'] },
      { id: 'massage_bien_etre',   label: 'Massage bien-être',    type: 'spa',          keywords: ['massage', 'bien-être'] },
    ],
  },
  {
    id: 'sante', label: 'SANTÉ',
    categories: [
      { id: 'dentistes',            label: 'Dentistes',              type: 'dentist',         keywords: ['dentiste'] },
      { id: 'medecins',             label: 'Médecins',               type: 'doctor',          keywords: ['médecin'] },
      { id: 'kinesitherapeutes',    label: 'Kinésithérapeutes',      type: 'physiotherapist', keywords: ['kinésithérapeute'] },
      { id: 'osteopathes',          label: 'Ostéopathes',            type: 'health',          keywords: ['ostéopathe'] },
      { id: 'chiropracteurs',       label: 'Chiropracteurs',         type: 'health',          keywords: ['chiropracteur'] },
      { id: 'orthophonistes',       label: 'Orthophonistes',         type: 'health',          keywords: ['orthophoniste'] },
      { id: 'orthoptistes',         label: 'Orthoptistes',           type: 'health',          keywords: ['orthoptiste'] },
      { id: 'pedicures_podologues', label: 'Pédicures-podologues',   type: 'health',          keywords: ['pédicure', 'podologue'] },
      { id: 'infirmiers',           label: 'Infirmiers',             type: 'health',          keywords: ['infirmier', 'infirmière libérale'] },
      { id: 'psychologues',         label: 'Psychologues',           type: 'health',          keywords: ['psychologue'] },
      { id: 'dieteticiens',         label: 'Diététiciens',           type: 'health',          keywords: ['diététicien'] },
      { id: 'opticiens',            label: 'Opticiens',              type: null,              keywords: ['opticien'] },
      { id: 'audioprothesistes',    label: 'Audioprothésistes',      type: 'health',          keywords: ['audioprothésiste'] },
      { id: 'pharmacies',           label: 'Pharmacies',             type: 'pharmacy',        keywords: ['pharmacie'] },
    ],
  },
  {
    id: 'services', label: 'SERVICES',
    categories: [
      { id: 'agences_immobilieres',   label: 'Agences immobilières',   type: 'real_estate_agency', keywords: ['agence immobilière'] },
      { id: 'architectes',            label: 'Architectes',            type: null,                 keywords: ['architecte'] },
      { id: 'geometres',              label: 'Géomètres',              type: null,                 keywords: ['géomètre'] },
      { id: 'experts_comptables',     label: 'Experts-comptables',     type: 'accounting',         keywords: ['expert-comptable'] },
      { id: 'avocats',                label: 'Avocats',                type: 'lawyer',             keywords: ['avocat'] },
      { id: 'notaires',               label: 'Notaires',               type: null,                 keywords: ['notaire'] },
      { id: 'assurances',             label: 'Assurances',             type: 'insurance_agency',   keywords: ['assurance'] },
      { id: 'courtiers',              label: 'Courtiers',              type: null,                 keywords: ['courtier'] },
      { id: 'traducteurs',            label: 'Traducteurs',            type: null,                 keywords: ['traducteur'] },
      { id: 'photographes',           label: 'Photographes',           type: null,                 keywords: ['photographe'] },
      { id: 'imprimeries',            label: 'Imprimeries',            type: null,                 keywords: ['imprimerie'] },
      { id: 'agences_communication',  label: 'Agences de communication', type: null,               keywords: ['agence de communication'] },
      { id: 'agences_web',            label: 'Agences web',            type: null,                 keywords: ['agence web'] },
      { id: 'consultants',            label: 'Consultants',            type: null,                 keywords: ['consultant'] },
    ],
  },
  {
    id: 'commerce', label: 'COMMERCE',
    categories: [
      { id: 'fleuristes',                 label: 'Fleuristes',                       type: 'florist',        keywords: ['fleuriste'] },
      { id: 'librairies',                 label: 'Librairies',                       type: 'book_store',     keywords: ['librairie'] },
      { id: 'papeteries',                 label: 'Papeteries',                       type: null,             keywords: ['papeterie'] },
      { id: 'magasins_jouets',            label: 'Magasins de jouets',               type: null,             keywords: ['magasin de jouets'] },
      { id: 'animaleries',                label: 'Animaleries',                      type: 'pet_store',      keywords: ['animalerie'] },
      { id: 'vetements_independants',     label: 'Magasins de vêtements indépendants', type: 'clothing_store', keywords: ['boutique de vêtements'] },
      { id: 'boutiques_chaussures',       label: 'Boutiques de chaussures',          type: 'shoe_store',     keywords: ['magasin de chaussures'] },
      { id: 'bijouteries',                label: 'Bijouteries',                      type: 'jewelry_store',  keywords: ['bijouterie'] },
      { id: 'horlogers',                  label: 'Horlogers',                        type: null,             keywords: ['horloger', 'horlogerie'] },
      { id: 'cordonniers',                label: 'Cordonniers',                      type: null,             keywords: ['cordonnier'] },
      { id: 'pressings',                  label: 'Pressings',                        type: 'laundry',        keywords: ['pressing'] },
      { id: 'retoucheries',               label: 'Retoucheries',                     type: 'laundry',        keywords: ['retoucherie', 'couturière'] },
    ],
  },
  {
    id: 'habitat', label: 'HABITAT',
    categories: [
      { id: 'magasins_decoration',              label: 'Magasins de décoration',              type: 'home_goods_store', keywords: ['magasin de décoration'] },
      { id: 'cuisinistes',                      label: 'Cuisinistes',                         type: 'home_goods_store', keywords: ['cuisiniste', 'cuisine sur mesure'] },
      { id: 'magasins_peinture',                label: 'Magasins de peinture',                type: 'hardware_store',   keywords: ['magasin de peinture'] },
      { id: 'magasins_bricolage_independants',  label: 'Magasins de bricolage indépendants',  type: 'hardware_store',   keywords: ['magasin de bricolage'] },
      { id: 'stores_volets',                    label: 'Stores et volets',                    type: 'general_contractor', keywords: ['store et volet', 'volet roulant'] },
      { id: 'cheminees',                        label: 'Cheminées',                           type: 'home_goods_store', keywords: ['cheminée', 'poêle à bois'] },
      { id: 'eclairage',                        label: 'Éclairage',                           type: 'home_goods_store', keywords: ['magasin de luminaires'] },
    ],
  },
  {
    id: 'sport', label: 'SPORT',
    categories: [
      { id: 'salles_sport',              label: 'Salles de sport',              type: 'gym',  keywords: ['salle de sport'] },
      { id: 'clubs_fitness',             label: 'Clubs de fitness',             type: 'gym',  keywords: ['club de fitness'] },
      { id: 'studios_yoga',              label: 'Studios de yoga',              type: 'gym',  keywords: ['studio de yoga'] },
      { id: 'studios_pilates',           label: 'Studios de pilates',           type: 'gym',  keywords: ['studio de pilates'] },
      { id: 'dojos',                     label: 'Dojos',                        type: 'gym',  keywords: ['dojo', 'arts martiaux'] },
      { id: 'clubs_danse',               label: 'Clubs de danse',               type: null,   keywords: ['école de danse', 'club de danse'] },
      { id: 'magasins_sport_independants', label: 'Magasins de sport indépendants', type: null, keywords: ['magasin de sport'] },
    ],
  },
  {
    id: 'education', label: 'ÉDUCATION',
    categories: [
      { id: 'auto_ecoles',       label: 'Auto-écoles',       type: null,     keywords: ['auto-école'] },
      { id: 'ecoles_privees',    label: 'Écoles privées',    type: 'school', keywords: ['école privée'] },
      { id: 'centres_formation', label: 'Centres de formation', type: 'school', keywords: ['centre de formation'] },
      { id: 'soutien_scolaire',  label: 'Soutien scolaire',  type: null,     keywords: ['soutien scolaire', 'cours particuliers'] },
      { id: 'cours_musique',     label: 'Cours de musique',  type: 'school', keywords: ['cours de musique', 'école de musique'] },
      { id: 'ecoles_langues',    label: 'Écoles de langues',  type: 'school', keywords: ['école de langues'] },
    ],
  },
  {
    id: 'tourisme', label: 'TOURISME',
    categories: [
      { id: 'hotels_independants', label: 'Hôtels indépendants', type: 'lodging',       keywords: ['hôtel indépendant'] },
      { id: 'chambres_hotes',      label: "Chambres d'hôtes",    type: 'lodging',       keywords: ["chambre d'hôtes"] },
      { id: 'gites',               label: 'Gîtes',                type: 'lodging',       keywords: ['gîte'] },
      { id: 'agences_voyages',     label: 'Agences de voyages',  type: 'travel_agency', keywords: ['agence de voyages'] },
      { id: 'guides_touristiques', label: 'Guides touristiques', type: null,            keywords: ['guide touristique'] },
    ],
  },
  {
    id: 'restauration', label: 'RESTAURATION',
    categories: [
      { id: 'restaurants',            label: 'Restaurants',            type: 'restaurant',    keywords: ['restaurant'] },
      { id: 'restaurants_halal',      label: 'Restaurants halal',      type: 'restaurant',    keywords: ['halal'] },
      { id: 'pizzerias',              label: 'Pizzerias',              type: 'restaurant',    keywords: ['pizzeria'] },
      { id: 'creperies',              label: 'Crêperies',              type: 'restaurant',    keywords: ['crêperie'] },
      { id: 'cafes',                  label: 'Cafés',                  type: 'cafe',          keywords: ['café'] },
      { id: 'salons_the',             label: 'Salons de thé',          type: 'cafe',          keywords: ['salon de thé'] },
      { id: 'fastfood_independants',  label: 'Fast-food indépendants', type: 'meal_takeaway', keywords: ['fast-food indépendant'] },
    ],
  },
]

export const CATEGORY_MAP: Record<string, Category> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap(g => g.categories.map(c => [c.id, c]))
)
