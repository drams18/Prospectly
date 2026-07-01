import { STATUS_LABELS, type ProspectStatus } from '@/types/prospect'

const STATUS_STYLES: Record<ProspectStatus, string> = {
  new: 'bg-slate-100 text-slate-600',
  seen: 'bg-warning-bg text-warning-text',
  contacted: 'bg-info-bg text-info-text',
  appointment: 'bg-primary-light text-primary',
  client: 'bg-success-bg text-success-text',
  refused: 'bg-danger-bg text-danger-text',
  follow_up: 'bg-orange-100 text-orange-700',
}

export function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
