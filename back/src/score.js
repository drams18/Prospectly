export function computeScore(lead) {
  let score = 0;

  if (!lead.website) {
    score += 60;
  }

  if ((lead.rating ?? 0) >= 4) {
    score += 20;
  }

  if ((lead.reviews ?? 0) >= 20) {
    score += 10;
  }

  if (lead.website) {
    if (lead.siteQuality === 'improvable') score += 20;
    if (lead.siteQuality === 'modern') score -= 40;
  }

  return clampScore(score);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getScoreLabel(score) {
  if (score >= 80) return 'opportunity';
  if (score >= 50) return 'medium';
  return 'low';
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
  if (lead.score >= 80) {
    return 0;
  }

  if (lead.score >= 50 || hasMissingOrBrokenWebsite(lead) || !lead.googleMapsUrl || hasIncompleteData(lead)) {
    return 1;
  }

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
