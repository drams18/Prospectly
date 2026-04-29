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

function hasIncompleteData(lead) {
  return !lead.name || !lead.address || !lead.phone;
}

function hasMissingOrBrokenWebsite(lead) {
  if (!lead.website) return true;
  const reasons = lead.badSiteReasons ?? [];
  return reasons.includes('Unreachable') || reasons.includes('HTTP error') || reasons.includes('Coming soon');
}

export function getLeadPriority(lead) {
  // High priority: no usable website presence or incomplete business data.
  if (hasMissingOrBrokenWebsite(lead) || !lead.googleMapsUrl || hasIncompleteData(lead)) {
    return 0;
  }

  // Medium priority: website exists but quality signals are weak.
  if (lead.isBadSite || (lead.platforms?.length ?? 0) > 0) {
    return 1;
  }

  // Low priority: complete profile and website quality looks acceptable.
  return 2;
}

export function sortResults(results) {
  return [...results].sort((a, b) => {
    // 1) Smart commercial priority first.
    const byPriority = getLeadPriority(a) - getLeadPriority(b);
    if (byPriority !== 0) return byPriority;

    // 2) Then sort by best commercial opportunity.
    if (b.score !== a.score) return b.score - a.score;
    if ((b.reviews ?? 0) !== (a.reviews ?? 0)) return (b.reviews ?? 0) - (a.reviews ?? 0);

    // 3) Finally nearest first.
    return (a.distance ?? Infinity) - (b.distance ?? Infinity);
  });
}
