import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useAddProspectNote, useProspectNotes } from '@/hooks/useProspectNotes'
import {
  useToggleFavorite, useUpdateProspectEmail, useUpdateProspectPriority,
  useUpdateProspectStatus, useUpdateProspectWebsite,
} from '@/hooks/useProspects'
import {
  useCompleteReminder, useCreateReminder, useDeleteReminder, useDuplicateReminder,
  useRemindersForProspect, useSnoozeReminder, useUpdateReminder,
} from '@/hooks/useReminders'
import { PROSPECT_STATUSES, STATUS_LABELS, type Prospect, type ProspectPriority, type Reminder } from '@/types/prospect'
import { StatusBadge } from './StatusBadge'

interface ProspectDetailPanelProps {
  prospect: Prospect
  onClose: () => void
  onDelete: () => void
  onRestore?: () => void
}

const PRIORITIES: ProspectPriority[] = ['low', 'medium', 'high']
const PRIORITY_LABELS: Record<ProspectPriority, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute' }

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

// Splits an ISO timestamp into the separate <input type="date"> / <input
// type="time"> values those controls expect, in the browser's local time.
function toDateTimeInputs(iso: string | null) {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function fromDateTimeInputs(date: string, time: string): string | null {
  if (!date || !time) return null
  const iso = new Date(`${date}T${time}`).toISOString()
  return iso
}

export function ProspectDetailPanel({ prospect, onClose, onDelete, onRestore }: ProspectDetailPanelProps) {
  // Tracked locally and updated optimistically on each action: the panel can
  // stay open across a mutation (e.g. right after Explorer's "Sauvegarder"),
  // and its `prospect` prop is a point-in-time snapshot that never refreshes
  // from the query cache on its own.
  const [status, setStatus] = useState(prospect.status)
  const [isFavorite, setIsFavorite] = useState(prospect.is_favorite)
  const [priority, setPriority] = useState(prospect.priority)
  const [email, setEmail] = useState(prospect.email ?? '')
  const [website, setWebsite] = useState(prospect.website ?? '')
  const [hoursOpen, setHoursOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [reminderForm, setReminderForm] = useState({ date: '', time: '', title: '', comment: '' })
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null)
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const websiteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateStatus = useUpdateProspectStatus()
  const updatePriority = useUpdateProspectPriority()
  const toggleFavorite = useToggleFavorite()
  const updateEmail = useUpdateProspectEmail()
  const updateWebsite = useUpdateProspectWebsite()

  const { data: notes = [] } = useProspectNotes(prospect.id)
  const addNote = useAddProspectNote(prospect.id)

  const { data: reminders = [] } = useRemindersForProspect(prospect.id)
  const createReminder = useCreateReminder(prospect.id)
  const updateReminder = useUpdateReminder(prospect.id)
  const deleteReminder = useDeleteReminder(prospect.id)
  const completeReminder = useCompleteReminder(prospect.id)
  const snoozeReminder = useSnoozeReminder(prospect.id)
  const duplicateReminder = useDuplicateReminder(prospect.id)

  useEffect(() => {
    setStatus(prospect.status)
    setIsFavorite(prospect.is_favorite)
    setPriority(prospect.priority)
    setEmail(prospect.email ?? '')
    setWebsite(prospect.website ?? '')
  }, [prospect.id, prospect.status, prospect.is_favorite, prospect.priority, prospect.email, prospect.website])

  function onStatusChange(next: Prospect['status']) {
    setStatus(next)
    updateStatus.mutate({ id: prospect.id, status: next })
  }

  function onPriorityChange(next: ProspectPriority) {
    setPriority(next === priority ? null : next)
    updatePriority.mutate({ id: prospect.id, priority: next === priority ? null : next })
  }

  function onToggleFavorite() {
    setIsFavorite(v => !v)
    toggleFavorite.mutate({ id: prospect.id, isFavorite: !isFavorite })
  }

  function onEmailChange(value: string) {
    setEmail(value)
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current)
    emailDebounceRef.current = setTimeout(() => {
      updateEmail.mutate({ id: prospect.id, email: value })
    }, 600)
  }

  function onWebsiteChange(value: string) {
    setWebsite(value)
    if (websiteDebounceRef.current) clearTimeout(websiteDebounceRef.current)
    websiteDebounceRef.current = setTimeout(() => {
      updateWebsite.mutate({ id: prospect.id, website: value })
    }, 600)
  }

  function onAddNote() {
    const content = noteDraft.trim()
    if (!content) return
    addNote.mutate(content)
    setNoteDraft('')
  }

  function onCreateReminder() {
    const remindAt = fromDateTimeInputs(reminderForm.date, reminderForm.time)
    if (!remindAt) return
    createReminder.mutate({ remindAt, title: reminderForm.title, comment: reminderForm.comment || null })
    setReminderForm({ date: '', time: '', title: '', comment: '' })
  }

  function onSnooze(reminder: Reminder, deltaMs: number) {
    const next = new Date(new Date(reminder.remind_at).getTime() + deltaMs).toISOString()
    snoozeReminder.mutate({ id: reminder.id, newRemindAt: next })
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
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-text-muted">Téléphone</label>
            {prospect.phone
              ? <a className="text-primary" href={`tel:${prospect.phone}`}>{prospect.phone}</a>
              : <span className="text-sm text-text-muted">Non renseigné</span>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="contact@exemple.fr"
              className="w-full rounded-app border border-border-strong px-2 py-1 text-sm text-text focus:border-primary focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase text-text-muted">Site web</label>
            <input
              type="text"
              value={website}
              onChange={(e) => onWebsiteChange(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-app border border-border-strong px-2 py-1 text-sm text-text focus:border-primary focus:outline-none"
            />
          </div>
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

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium uppercase text-text-muted">Priorité</label>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => onPriorityChange(p)}
                className={`rounded-app border px-3 py-1.5 text-sm ${
                  priority === p
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border-strong text-text-secondary hover:bg-bg'
                }`}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {prospect.phone && <a className="quick-action" href={`tel:${prospect.phone}`}>Appeler</a>}
          {prospect.google_maps_url && <a className="quick-action" href={prospect.google_maps_url} target="_blank" rel="noopener">Maps</a>}
        </div>

        <div className="mt-6">
          <label className="mb-1 block text-xs font-medium uppercase text-text-muted">Rappels</label>
          <div className="space-y-2">
            {reminders.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                editing={editingReminderId === r.id}
                onEdit={() => setEditingReminderId(editingReminderId === r.id ? null : r.id)}
                onSave={(patch) => { updateReminder.mutate({ id: r.id, input: patch }); setEditingReminderId(null) }}
                onDelete={() => deleteReminder.mutate(r.id)}
                onComplete={() => completeReminder.mutate(r.id)}
                onSnooze={(deltaMs) => onSnooze(r, deltaMs)}
                onDuplicate={() => duplicateReminder.mutate(r)}
              />
            ))}
            {reminders.length === 0 && <p className="text-sm text-text-muted">Aucun rappel.</p>}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 rounded-app border border-border-strong p-3 sm:grid-cols-4">
            <input
              type="date"
              value={reminderForm.date}
              onChange={(e) => setReminderForm(f => ({ ...f, date: e.target.value }))}
              className="rounded-app border border-border-strong px-2 py-1 text-sm"
            />
            <input
              type="time"
              value={reminderForm.time}
              onChange={(e) => setReminderForm(f => ({ ...f, time: e.target.value }))}
              className="rounded-app border border-border-strong px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Titre"
              value={reminderForm.title}
              onChange={(e) => setReminderForm(f => ({ ...f, title: e.target.value }))}
              className="rounded-app border border-border-strong px-2 py-1 text-sm sm:col-span-2"
            />
            <input
              type="text"
              placeholder="Commentaire"
              value={reminderForm.comment}
              onChange={(e) => setReminderForm(f => ({ ...f, comment: e.target.value }))}
              className="col-span-2 rounded-app border border-border-strong px-2 py-1 text-sm sm:col-span-3"
            />
            <button
              onClick={onCreateReminder}
              disabled={!reminderForm.date || !reminderForm.time}
              className="rounded-app bg-primary px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              + Ajouter
            </button>
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-1 block text-xs font-medium uppercase text-text-muted">Notes</label>
          <div className="flex gap-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
              placeholder="Ex: le responsable rappelle mardi…"
              className="w-full rounded-app border border-border-strong px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            />
            <button
              onClick={onAddNote}
              disabled={!noteDraft.trim()}
              className="flex-none self-start rounded-app bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-app border border-border bg-bg px-3 py-2">
                <div className="text-xs text-text-muted">{formatDateTime(n.created_at)}</div>
                <div className="whitespace-pre-wrap text-sm text-text">{n.content}</div>
              </li>
            ))}
            {notes.length === 0 && <li className="text-sm text-text-muted">Aucune note pour l'instant.</li>}
          </ul>
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

interface ReminderRowProps {
  reminder: Reminder
  editing: boolean
  onEdit: () => void
  onSave: (patch: { remindAt?: string; title?: string; comment?: string | null }) => void
  onDelete: () => void
  onComplete: () => void
  onSnooze: (deltaMs: number) => void
  onDuplicate: () => void
}

const HOUR_MS = 60 * 60_000
const DAY_MS = 24 * HOUR_MS

function ReminderRow({ reminder, editing, onEdit, onSave, onDelete, onComplete, onSnooze, onDuplicate }: ReminderRowProps) {
  const initial = toDateTimeInputs(reminder.remind_at)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [title, setTitle] = useState(reminder.title)
  const [comment, setComment] = useState(reminder.comment ?? '')

  const done = reminder.status === 'done'
  const overdue = !done && new Date(reminder.remind_at).getTime() < Date.now()

  if (editing) {
    return (
      <div className="rounded-app border border-primary bg-primary-light/30 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-app border border-border-strong px-2 py-1 text-sm" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-app border border-border-strong px-2 py-1 text-sm" />
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className="rounded-app border border-border-strong px-2 py-1 text-sm sm:col-span-2" />
          <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentaire" className="col-span-2 rounded-app border border-border-strong px-2 py-1 text-sm sm:col-span-4" />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onSave({ remindAt: fromDateTimeInputs(date, time) ?? undefined, title, comment: comment || null })}
            className="rounded-app bg-primary px-3 py-1 text-sm font-medium text-white"
          >
            Enregistrer
          </button>
          <button onClick={onEdit} className="rounded-app border border-border-strong px-3 py-1 text-sm text-text-secondary hover:bg-bg">Annuler</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-app border px-3 py-2 ${done ? 'border-border bg-bg opacity-60' : overdue ? 'border-danger-text bg-danger-bg' : 'border-border-strong bg-surface'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-sm font-medium text-text ${done ? 'line-through' : ''}`}>
            {formatDateTime(reminder.remind_at)}{reminder.title ? ` — ${reminder.title}` : ''}
          </div>
          {reminder.comment && <div className="text-sm text-text-secondary">{reminder.comment}</div>}
        </div>
        <div className="flex flex-wrap gap-1">
          {!done && (
            <>
              <button onClick={onEdit} className="quick-action-sm">Modifier</button>
              <button onClick={() => onSnooze(HOUR_MS)} className="quick-action-sm">+1h</button>
              <button onClick={() => onSnooze(DAY_MS)} className="quick-action-sm">+1j</button>
              <button onClick={() => onSnooze(7 * DAY_MS)} className="quick-action-sm">+1sem</button>
              <button onClick={onComplete} className="quick-action-sm">Effectué</button>
            </>
          )}
          <button onClick={onDuplicate} className="quick-action-sm">Dupliquer</button>
          <button onClick={onDelete} className="quick-action-sm text-danger-text">Supprimer</button>
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
