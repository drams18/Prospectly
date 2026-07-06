import type { SearchLead } from '@/types/prospect'

const FALLBACK_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <rect width="800" height="450" fill="#f1f5f9"/>
    <circle cx="400" cy="185" r="36" fill="#94a3b8"/>
    <rect x="280" y="260" width="240" height="16" rx="8" fill="#94a3b8"/>
    <rect x="320" y="286" width="160" height="12" rx="6" fill="#cbd5e1"/>
  </svg>`
)

const BADGE: Record<'hot' | 'medium' | 'low', { emoji: string; label: string }> = {
  hot: { emoji: '🔥', label: 'Excellent prospect' },
  medium: { emoji: '🟡', label: 'Bon prospect' },
  low: { emoji: '⚪', label: 'Faible potentiel' },
}

function formatDistance(meters: number | null) {
  if (meters == null) return null
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`
}

interface ProspectCardProps {
  lead: SearchLead
  saved: boolean
  onOpen: () => void
  onSave: () => void
}

export function ProspectCard({ lead, saved, onOpen, onSave }: ProspectCardProps) {
  const badge = BADGE[lead.scoreLabel]
  const distance = formatDistance(lead.distance)

  return (
    <div className="cursor-pointer overflow-hidden rounded-app-lg border border-border bg-surface shadow-sm transition hover:shadow-md" onClick={onOpen}>
      <div className="relative h-32 w-full bg-bg">
        <img src={lead.imageUrl ?? FALLBACK_IMAGE} alt={lead.name} loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-text">
          <span>{badge.emoji}</span>
          <span>{lead.score}/100</span>
        </div>
        <div className="absolute bottom-2 left-3 right-3 truncate font-medium text-white">{lead.name}</div>
      </div>

      <div className="space-y-2 p-3">
        {lead.category && <div className="text-sm text-text-secondary">{lead.category}</div>}

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-text-secondary">
          {distance && <div>{distance}</div>}
          {lead.rating != null && <div>★ {lead.rating} ({lead.reviews} avis)</div>}
          <div>Site web : {lead.website ? 'Oui' : 'Non'}</div>
          <div>Réservation : {lead.hasBooking ? 'Oui' : 'Non'}</div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          {lead.phone && <a className="quick-action" href={`tel:${lead.phone}`}>Appeler</a>}
          <a className="quick-action" href={lead.googleMapsUrl} target="_blank" rel="noopener">Maps</a>
          <button className="quick-action" onClick={onSave} disabled={saved}>
            {saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
