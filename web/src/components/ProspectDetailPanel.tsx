import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useToggleFavorite, useUpdateProspectNotes, useUpdateProspectStatus } from '@/hooks/useProspects'
import { PROSPECT_STATUSES, STATUS_LABELS, type Prospect } from '@/types/prospect'
import { StatusBadge } from './StatusBadge'

interface ProspectDetailPanelProps {
  prospect: Prospect
  onClose: () => void
  onDelete: () => void
  onRestore?: () => void
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export function ProspectDetailPanel({ prospect, onClose, onDelete, onRestore }: ProspectDetailPanelProps) {
  // Tracked locally and updated optimistically on each action: the panel can
  // stay open across a mutation (e.g. right after Explorer's "Sauvegarder"),
  // and its `prospect` prop is a point-in-time snapshot that never refreshes
  // from the query cache on its own.
  const [status, setStatus] = useState(prospect.status)
  const [isFavorite, setIsFavorite] = useState(prospect.is_favorite)
  const [notes, setNotes] = useState(prospect.notes ?? '')
  const [hoursOpen, setHoursOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateStatus = useUpdateProspectStatus()
  const updateNotes = useUpdateProspectNotes()
  const toggleFavorite = useToggleFavorite()

  useEffect(() => {
    setStatus(prospect.status)
    setIsFavorite(prospect.is_favorite)
    setNotes(prospect.notes ?? '')
  }, [prospect.id, prospect.status, prospect.is_favorite, prospect.notes])

  function onStatusChange(next: Prospect['status']) {
    setStatus(next)
    updateStatus.mutate({ id: prospect.id, status: next })
  }

  function onToggleFavorite() {
    setIsFavorite(v => !v)
    toggleFavorite.mutate({ id: prospect.id, isFavorite: !isFavorite })
  }

  function onNotesChange(value: string) {
    setNotes(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateNotes.mutate({ id: prospect.id, notes: value })
    }, 600)
  }

  // Number keys 1-3 jump straight to a status while the panel is open.
  useHotkeys(
    Object.fromEntries(
      PROSPECT_STATUSES.map((s, i) => [String(i + 1), () => onStatusChange(s)])
    ),
    [prospect.id]
  )
  useHotkeys({ Escape: onClose }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-app-lg bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-text">{prospect.name}</h2>
            {prospect.address && <p className="text-sm text-text-secondary">{prospect.address}</p>}
          </div>
          <button onClick={onClose} className="rounded-app p-1 text-text-muted hover:bg-bg" aria-label="Fermer">✕</button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <button
            onClick={onToggleFavorite}
            className={`rounded-app px-2 py-1 text-sm ${isFavorite ? 'text-warning-text' : 'text-text-muted'}`}
            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            {isFavorite ? '★ Favori' : '☆ Favori'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {prospect.phone && (
            <Field label="Téléphone" value={<a className="text-primary" href={`tel:${prospect.phone}`}>{prospect.phone}</a>} />
          )}
          <Field label="Site web" value={prospect.website ? <a className="truncate text-primary" href={prospect.website} target="_blank" rel="noopener">{prospect.website}</a> : 'Non'} />
          <Field label="Instagram" value={prospect.has_instagram ? 'Oui' : 'Non'} />
          <Field label="Réservation en ligne" value={prospect.has_booking ? 'Oui' : 'Non'} />
          {prospect.rating != null && <Field label="Note Google" value={`★ ${prospect.rating} (${prospect.reviews ?? 0} avis)`} />}
          {prospect.score != null && <Field label="Score" value={`${prospect.score}/100`} />}
          <Field label="Première consultation" value={formatDateTime(prospect.first_seen_at)} />
          <Field label="Dernière consultation" value={formatDateTime(prospect.last_seen_at)} />
        </div>

        {!!prospect.photos?.length && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {prospect.photos.map((url) => (
              <img key={url} src={url} alt={prospect.name} className="h-20 w-20 flex-none rounded-app object-cover" />
            ))}
          </div>
        )}

        {!!prospect.opening_hours?.weekdayText?.length && (
          <div className="mt-3">
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={() => setHoursOpen((v) => !v)}
            >
              {hoursOpen ? 'Masquer les horaires' : 'Voir les horaires'}
            </button>
            {hoursOpen && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-text-secondary">
                {prospect.opening_hours.weekdayText.map((line) => <li key={line}>{line}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium uppercase text-text-muted">Changer le statut</label>
          <div className="flex flex-wrap gap-2">
            {PROSPECT_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`rounded-app border px-3 py-1.5 text-sm ${
                  status === s
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border-strong text-text-secondary hover:bg-bg'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {prospect.phone && <a className="quick-action" href={`tel:${prospect.phone}`}>Appeler</a>}
          {prospect.google_maps_url && <a className="quick-action" href={prospect.google_maps_url} target="_blank" rel="noopener">Maps</a>}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium uppercase text-text-muted">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            placeholder="Ex: le responsable rappelle mardi…"
            className="w-full rounded-app border border-border-strong px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {onRestore && prospect.is_seen && (
            <button onClick={onRestore} className="rounded-app border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg">
              Remettre dans le feed
            </button>
          )}
          {onRestore && !prospect.is_seen && (
            <span className="rounded-app px-3 py-2 text-sm text-text-muted">Déjà dans le feed</span>
          )}
          <button onClick={onDelete} className="rounded-app px-3 py-2 text-sm font-medium text-danger-text hover:bg-danger-bg">
            Supprimer ce prospect
          </button>
        </div>
      </div>
    </div>
  )
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase text-text-muted">{label}</div>
      <div className="truncate text-sm text-text">{value}</div>
    </div>
  )
}
