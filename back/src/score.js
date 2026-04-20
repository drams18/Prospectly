/**
 * Calcule un score de potentiel commercial (0–100) pour chaque salon.
 *
 * Critères :
 *  - Absence de site web propre (+40 pts)
 *  - Présence uniquement sur plateforme(+25 pts)
 *  - Activité réelle (nombre d'avis, pondéré) (+0–20 pts)
 *  - Bonne note Google (signe de qualité, client potentiellement sérieux) (+0–10 pts)
 *  - Proximité (distance < 1km = bonus) (+0–10 pts)
 */
export function computeScore(salon) {
  let score = 0;
  const reasons = [];

  // --- Présence web ---
  if (!salon.hasSite) {
    score += 40;
    reasons.push('Pas de site web');
  } else if (!salon.isOwnSite && salon.platforms?.length) {
    score += 25;
    reasons.push(`Uniquement sur ${salon.platforms.join(', ')}`);
  } else {
    // A un site propre → pas prioritaire
    score += 0;
  }

  // --- Activité (avis Google) ---
  const reviews = salon.user_ratings_total || 0;
  if (reviews >= 100) {
    score += 20;
    reasons.push('Très actif (+100 avis)');
  } else if (reviews >= 30) {
    score += 12;
    reasons.push('Actif (30–99 avis)');
  } else if (reviews >= 10) {
    score += 6;
    reasons.push('Peu d\'avis (10–29)');
  } else {
    score += 2;
    reasons.push('Très peu d\'avis (<10)');
  }

  // --- Note Google ---
  const rating = salon.rating || 0;
  if (rating >= 4.5) {
    score += 10;
    reasons.push(`Note excellente (${rating}/5)`);
  } else if (rating >= 4.0) {
    score += 7;
    reasons.push(`Bonne note (${rating}/5)`);
  } else if (rating >= 3.5) {
    score += 3;
  }

  // --- Proximité ---
  const dist = salon.distance_meters || 9999;
  if (dist <= 500) {
    score += 10;
    reasons.push('Très proche (<500m)');
  } else if (dist <= 1000) {
    score += 7;
    reasons.push('Proche (<1km)');
  } else if (dist <= 2000) {
    score += 4;
  }

  const priority = score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';

  return { score: Math.min(score, 100), priority, reasons };
}

/**
 * Trie les salons selon le score décroissant, puis par distance.
 */
export function rankSalons(salons) {
  return [...salons].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.distance_meters || 0) - (b.distance_meters || 0);
  });
}
