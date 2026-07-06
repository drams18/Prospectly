import { useHotkeys } from '@/hooks/useHotkeys'
import { useSaveLead } from '@/hooks/useSearch'
import type { Prospect, SearchLead } from '@/types/prospect'
import { Field } from './ProspectDetailPanel'

interface LeadPreviewPanelProps {
  lead: SearchLead
  onClose: () => void
  onSaved: (prospect: Prospect) => void
}

export function LeadPreviewPanel({ lead, onClose, onSaved }: LeadPreviewPanelProps) {
  const saveLead = useSaveLead()
  useHotkeys({ Escape: onClose }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-app-lg bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-text">{lead.name}</h2>
            <p className="text-sm text-text-secondary">{lead.address}</p>
          </div>
          <button onClick={onClose} className="rounded-app p-1 text-text-muted hover:bg-bg" aria-label="Fermer">✕</button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lead.phone && (
            <Field label="Téléphone" value={<a className="text-primary" href={`tel:${lead.phone}`}>{lead.phone}</a>} />
          )}
          <Field label="Site web" value={lead.website ? <a className="truncate text-primary" href={lead.website} target="_blank" rel="noopener">{lead.website}</a> : 'Non'} />
          <Field label="Instagram" value={lead.hasInstagram ? 'Oui' : 'Non'} />
          <Field label="Réservation en ligne" value={lead.hasBooking ? 'Oui' : 'Non'} />
          {lead.rating != null && <Field label="Note Google" value={`★ ${lead.rating} (${lead.reviews} avis)`} />}
          <Field label="Score" value={`${lead.score}/100`} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {lead.phone && <a className="quick-action" href={`tel:${lead.phone}`}>Appeler</a>}
          <a className="quick-action" href={lead.googleMapsUrl} target="_blank" rel="noopener">Maps</a>
          <button className="quick-action" onClick={() => saveLead.mutate(lead, { onSuccess: onSaved })} disabled={saveLead.isPending}>
            {saveLead.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
