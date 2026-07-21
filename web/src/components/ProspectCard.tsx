import type { SearchLead } from '@/types/prospect'
import { BADGE, FALLBACK_IMAGE } from '@/utils/leadPresentation'

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
