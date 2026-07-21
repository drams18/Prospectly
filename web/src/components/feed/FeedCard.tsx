import { useState } from 'react'
import type { SearchLead } from '@/types/prospect'
import { buildLeadDescription } from '@/utils/leadDescription'
import { BADGE } from '@/utils/leadPresentation'
import { PhotoGallery } from './PhotoGallery'

function formatDistance(meters: number | null) {
  if (meters == null) return null
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`
}

interface FeedCardProps {
  lead: SearchLead
  saved: boolean
  interactive: boolean
  onSave?: () => void
  onSkip?: () => void
}

export function FeedCard({ lead, saved, interactive, onSave, onSkip }: FeedCardProps) {
  const [hoursOpen, setHoursOpen] = useState(false)
  const badge = BADGE[lead.scoreLabel]
  const distance = formatDistance(lead.distance)
  const description = buildLeadDescription(lead)
  const hours = lead.openingHours

  return (
    <div className="mx-auto h-full w-full sm:max-w-[460px] sm:py-4">
      <div className="relative h-full w-full overflow-hidden bg-surface shadow-2xl sm:rounded-app-lg">
        <PhotoGallery photos={lead.photos?.length ? lead.photos : lead.imageUrl ? [lead.imageUrl] : []} alt={lead.name} interactive={interactive} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/35" />

        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-2">
          {lead.category && (
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-text shadow-sm">{lead.category}</span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-text shadow-sm">
            <span>{badge.emoji}</span><span>{lead.score}/100</span>
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 max-h-[66%] overflow-y-auto rounded-t-app-lg bg-white/94 px-5 pb-24 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] backdrop-blur-xl sm:pb-28">
          <h2 className="text-xl font-semibold text-text">{lead.name}</h2>
          {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-text-secondary">
            {distance && <span>{distance}</span>}
            {hours && (
              <span className={hours.openNow ? 'text-success-text' : 'text-danger-text'}>
                {hours.openNow == null ? '' : hours.openNow ? 'Ouvert' : 'Fermé'}
              </span>
            )}
            <span>Site web {lead.website ? '✓' : '✗'}</span>
            <span>Réservation {lead.hasBooking ? '✓' : '✗'}</span>
            {lead.hasInstagram && <span>Instagram ✓</span>}
          </div>

          <p className="mt-2 text-sm text-text-secondary">{lead.address}</p>

          {!!hours?.weekdayText.length && (
            <div className="mt-2">
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() => setHoursOpen((v) => !v)}
              >
                {hoursOpen ? 'Masquer les horaires' : 'Voir les horaires'}
              </button>
              {hoursOpen && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-text-secondary">
                  {hours.weekdayText.map((line) => <li key={line}>{line}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {interactive && (
          <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 pb-6 pt-3">
            <button
              type="button"
              onClick={onSkip}
              aria-label="Passer"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg text-text-secondary shadow-lg transition hover:scale-105"
            >
              ✕
            </button>
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                aria-label="Appeler"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg shadow-lg transition hover:scale-105"
              >
                📞
              </a>
            )}
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener"
                aria-label="Site web"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg shadow-lg transition hover:scale-105"
              >
                🌐
              </a>
            )}
            <a
              href={lead.googleMapsUrl}
              target="_blank"
              rel="noopener"
              aria-label="Maps"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg shadow-lg transition hover:scale-105"
            >
              📍
            </a>
            <button
              type="button"
              onClick={onSave}
              disabled={saved}
              aria-label="Sauvegarder"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl text-white shadow-lg transition hover:scale-105 disabled:opacity-60"
            >
              {saved ? '✓' : '＋'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
