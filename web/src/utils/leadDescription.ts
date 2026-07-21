import type { SearchLead } from '@/types/prospect'

// Google's legacy Places API has no free-text description field. Synthesized
// client-side from fields already fetched, e.g. "Restaurant · 4.3★ (120 avis) · Paris 11e".
export function buildLeadDescription(lead: SearchLead): string {
  const parts: string[] = []

  if (lead.category) parts.push(lead.category)
  if (lead.rating != null) parts.push(`${lead.rating.toFixed(1)}★ (${lead.reviews} avis)`)

  const city = lead.address.split(',').map((p) => p.trim()).filter(Boolean).pop()
  if (city) parts.push(city)

  return parts.join(' · ')
}
