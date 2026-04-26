export function computeScore(salon) {
  let score = 0;

  // Présence web
  if (!salon.website) {
    score += 50;
  } else if (salon.platforms?.length) {
    score += 35;
  } else if (salon.isBadSite) {
    score += 30;
  }

  // Activité (avis)
  if (salon.reviews >= 100) score += 20;

  // Téléphone disponible
  if (salon.phone) score += 15;

  // Note Google
  if (salon.rating >= 4.2) score += 10;

  // Activité récente (a des avis)
  if (salon.reviews > 0) score += 10;

  // Proximité
  if (salon.distance != null && salon.distance <= 500) score += 10;

  return Math.min(score, 100);
}

export function sortResults(results) {
  return [...results].sort((a, b) => {
    // 1. Sans site en premier
    const aNo = !a.website ? 0 : 1;
    const bNo = !b.website ? 0 : 1;
    if (aNo !== bNo) return aNo - bNo;
    // 2. Score décroissant
    if (b.score !== a.score) return b.score - a.score;
    // 3. Distance croissante
    return (a.distance ?? Infinity) - (b.distance ?? Infinity);
  });
}
