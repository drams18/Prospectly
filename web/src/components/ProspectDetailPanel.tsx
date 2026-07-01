import { useEffect, useRef, useState, type ReactNode } from 'react'
import { buildCallScript, buildSmsMessage } from '@/data/scripts'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useProspectHistory, useToggleFavorite, useUpdateProspectNotes, useUpdateProspectStatus } from '@/hooks/useProspects'
import { PROSPECT_STATUSES, STATUS_LABELS, type Prospect } from '@/types/prospect'
import { StatusBadge } from './StatusBadge'

interface ProspectDetailPanelProps {
  prospect: Prospect
  onClose: () => void
  onDelete: () => void
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Créé',
  status_change: 'Statut modifié',
  note_updated: 'Note modifiée',
  favorite_toggled: 'Favori modifié',
}

export function ProspectDetailPanel({ prospect, onClose, onDelete }: ProspectDetailPanelProps) {
  const [notes, setNotes] = useState(prospect.notes ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: history } = useProspectHistory(prospect.id)
  const updateStatus = useUpdateProspectStatus()
  const updateNotes = useUpdateProspectNotes()
  const toggleFavorite = useToggleFavorite()

  useEffect(() => {
    setNotes(prospect.notes ?? '')
  }, [prospect.id, prospect.notes])

  function onNotesChange(value: string) {
    setNotes(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateNotes.mutate({ id: prospect.id, notes: value })
    }, 600)
  }

  // Number keys 1-7 jump straight to a status while the panel is open —
  // matches the "changement de statut en un clic" requirement.
  useHotkeys(
    Object.fromEntries(
      PROSPECT_STATUSES.map((status, i) => [
        String(i + 1),
        () => updateStatus.mutate({ id: prospect.id, status }),
      ])
    ),
    [prospect.id]
  )
  useHotkeys({ Escape: onClose }, [onClose])

  async function copy(text: string) {
    if (!text) return
    await navigator.clipboard.writeText(text)
  }

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
          <StatusBadge status={prospect.status} />
          <button
            onClick={() => toggleFavorite.mutate({ id: prospect.id, isFavorite: !prospect.is_favorite })}
            className={`rounded-app px-2 py-1 text-sm ${prospect.is_favorite ? 'text-warning-text' : 'text-text-muted'}`}
            title={prospect.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            {prospect.is_favorite ? '★ Favori' : '☆ Favori'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {prospect.phone && (
            <Field label="Téléphone" value={<a className="text-primary" href={`tel:${prospect.phone}`}>{prospect.phone}</a>} />
          )}
          {prospect.website && (
            <Field label="Site web" value={<a className="truncate text-primary" href={prospect.website} target="_blank" rel="noopener">{prospect.website}</a>} />
          )}
          {prospect.category && <Field label="Catégorie" value={prospect.category} />}
          {prospect.rating != null && <Field label="Note" value={`★ ${prospect.rating} (${prospect.reviews ?? 0} avis)`} />}
          {prospect.score != null && <Field label="Score" value={`${prospect.score}/100`} />}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium uppercase text-text-muted">Changer le statut</label>
          <div className="flex flex-wrap gap-2">
            {PROSPECT_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => updateStatus.mutate({ id: prospect.id, status })}
                className={`rounded-app border px-3 py-1.5 text-sm ${
                  prospect.status === status
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border-strong text-text-secondary hover:bg-bg'
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {prospect.phone && <a className="quick-action" href={`tel:${prospect.phone}`}>Appeler</a>}
          {prospect.phone && <button className="quick-action" onClick={() => copy(prospect.phone!)}>Copier numéro</button>}
          <button className="quick-action" onClick={() => copy(buildSmsMessage(prospect.name, prospect.category))}>Copier SMS</button>
          <button className="quick-action" onClick={() => copy(buildCallScript(prospect.name, prospect.category))}>Copier script appel</button>
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

        <div className="mt-4">
          <div className="mb-1 text-xs font-medium uppercase text-text-muted">Historique</div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-app border border-border p-2">
            {!history?.length && <div className="text-sm text-text-muted">Aucun historique</div>}
            {history?.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-text-secondary">{ACTION_LABELS[h.action] ?? h.action}{h.new_value ? ` → ${h.new_value}` : ''}</span>
                <span className="shrink-0 text-xs text-text-muted">{new Date(h.created_at).toLocaleString('fr-FR')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onDelete} className="rounded-app px-3 py-2 text-sm font-medium text-danger-text hover:bg-danger-bg">
            Supprimer ce prospect
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase text-text-muted">{label}</div>
      <div className="truncate text-sm text-text">{value}</div>
    </div>
  )
}
