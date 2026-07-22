import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUpcomingReminders } from '@/hooks/useReminders'
import type { ReminderWithProspect } from '@/types/prospect'

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

interface Groups {
  overdue: ReminderWithProspect[]
  today: ReminderWithProspect[]
  tomorrow: ReminderWithProspect[]
  thisWeek: ReminderWithProspect[]
}

function groupReminders(reminders: ReminderWithProspect[]): Groups {
  const now = new Date()
  const today0 = startOfDay(now)
  const tomorrow0 = new Date(today0.getTime() + 24 * 60 * 60_000)
  const weekEnd = new Date(today0.getTime() + 7 * 24 * 60 * 60_000)

  const groups: Groups = { overdue: [], today: [], tomorrow: [], thisWeek: [] }
  for (const r of reminders) {
    const at = new Date(r.remind_at)
    if (at < now) groups.overdue.push(r)
    else if (at < tomorrow0) groups.today.push(r)
    else if (at < new Date(tomorrow0.getTime() + 24 * 60 * 60_000)) groups.tomorrow.push(r)
    else if (at < weekEnd) groups.thisWeek.push(r)
  }
  return groups
}

export default function RemindersPage() {
  const navigate = useNavigate()
  const { data: reminders = [], isLoading } = useUpcomingReminders()

  const groups = useMemo(() => groupReminders(reminders), [reminders])

  const stats = useMemo(() => {
    const now = new Date()
    const weekEnd = new Date(startOfDay(now).getTime() + 7 * 24 * 60 * 60_000)
    const thisWeekCount = reminders.filter(r => new Date(r.remind_at) < weekEnd).length
    const next = reminders.filter(r => new Date(r.remind_at) >= now)[0]
    return {
      today: groups.today.length,
      overdue: groups.overdue.length,
      next,
      thisWeekCount,
    }
  }, [reminders, groups])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold text-text">Rappels</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Aujourd'hui" value={stats.today} />
        <StatCard label="En retard" value={stats.overdue} tone={stats.overdue > 0 ? 'danger' : undefined} />
        <StatCard label="Prochain rappel" value={stats.next ? `${formatDate(stats.next.remind_at)} ${formatTime(stats.next.remind_at)}` : '—'} />
        <StatCard label="Cette semaine" value={stats.thisWeekCount} />
      </div>

      {isLoading && <p className="mt-6 text-sm text-text-muted">Chargement…</p>}

      {!isLoading && reminders.length === 0 && (
        <p className="mt-6 text-sm text-text-muted">Aucun rappel programmé.</p>
      )}

      <ReminderGroup title="En retard" items={groups.overdue} onOpen={(id) => navigate(`/prospects/${id}`)} danger />
      <ReminderGroup title="Aujourd'hui" items={groups.today} onOpen={(id) => navigate(`/prospects/${id}`)} />
      <ReminderGroup title="Demain" items={groups.tomorrow} onOpen={(id) => navigate(`/prospects/${id}`)} />
      <ReminderGroup title="Cette semaine" items={groups.thisWeek} onOpen={(id) => navigate(`/prospects/${id}`)} />
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: 'danger' }) {
  return (
    <div className={`rounded-app-lg border px-3 py-3 ${tone === 'danger' ? 'border-danger-text bg-danger-bg' : 'border-border bg-surface'}`}>
      <div className="text-xs font-medium uppercase text-text-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === 'danger' ? 'text-danger-text' : 'text-text'}`}>{value}</div>
    </div>
  )
}

function ReminderGroup({ title, items, onOpen, danger }: {
  title: string
  items: ReminderWithProspect[]
  onOpen: (prospectId: string) => void
  danger?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div className="mt-6">
      <h2 className={`mb-2 text-sm font-semibold uppercase ${danger ? 'text-danger-text' : 'text-text-secondary'}`}>{title}</h2>
      <div className="space-y-2">
        {items.map((r) => (
          <button
            key={r.id}
            onClick={() => onOpen(r.prospect_id)}
            className="flex w-full items-center justify-between gap-3 rounded-app-lg border border-border bg-surface px-4 py-3 text-left hover:shadow-sm"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-text">{r.prospect_name}</div>
              {r.title && <div className="truncate text-sm text-text-secondary">{r.title}</div>}
              {r.comment && <div className="truncate text-sm text-text-muted">{r.comment}</div>}
            </div>
            <div className="flex-none text-sm font-medium text-text-secondary">
              {formatDate(r.remind_at)} · {formatTime(r.remind_at)}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
