import type { ReactNode } from 'react'
import type { SearchLead } from '@/types/prospect'

const FALLBACK_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <rect width="800" height="450" fill="#f1f5f9"/>
    <circle cx="400" cy="185" r="36" fill="#94a3b8"/>
    <rect x="280" y="260" width="240" height="16" rx="8" fill="#94a3b8"/>
    <rect x="320" y="286" width="160" height="12" rx="6" fill="#cbd5e1"/>
  </svg>`
)

const SCORE_STYLES: Record<'hot' | 'medium' | 'low', string> = {
  hot: 'bg-danger-text',
  medium: 'bg-warning-text',
  low: 'bg-text-muted',
}

function formatDistance(meters: number | null) {
  if (meters == null) return null
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`
}

export function ProspectCard({ lead, onOpen }: { lead: SearchLead; onOpen: () => void }) {
  return (
    <div className="cursor-pointer overflow-hidden rounded-app-lg border border-border bg-surface shadow-sm transition hover:shadow-md" onClick={onOpen}>
      <div className="relative h-36 w-full bg-bg">
        <img src={lead.imageUrl ?? FALLBACK_IMAGE} alt={lead.name} loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className={`absolute left-3 top-3 rounded-full px-2 py-1 text-xs font-semibold text-white ${SCORE_STYLES[lead.scoreLabel]}`}>
          {lead.score}
        </div>
        <div className="absolute bottom-2 left-3 right-3 truncate font-medium text-white">{lead.name}</div>
      </div>

      <div className="space-y-2 p-3">
        <div className="truncate text-sm text-text-secondary">{lead.address}</div>
        <div className="flex flex-wrap gap-1.5">
          {!lead.website && <Tag className="bg-danger-bg text-danger-text">Pas de site</Tag>}
          {!lead.hasBooking && <Tag className="bg-warning-bg text-warning-text">Pas de réservation</Tag>}
          {lead.hasInstagram && <Tag className="bg-info-bg text-info-text">Instagram</Tag>}
          {lead.wastedPotential && <Tag className="bg-primary-light text-primary">Potentiel perdu</Tag>}
          {lead.rating && <Tag className="bg-bg text-text-secondary">★ {lead.rating}</Tag>}
          {lead.reviews > 0 && <Tag className="bg-bg text-text-secondary">{lead.reviews} avis</Tag>}
          {formatDistance(lead.distance) && <Tag className="bg-bg text-text-secondary">{formatDistance(lead.distance)}</Tag>}
        </div>
        <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          {lead.phone && <a className="quick-action" href={`tel:${lead.phone}`}>Appeler</a>}
          <a className="quick-action" href={lead.googleMapsUrl} target="_blank" rel="noopener">Maps</a>
        </div>
      </div>
    </div>
  )
}

function Tag({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>
}
