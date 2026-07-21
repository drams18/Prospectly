import { STATUS_LABELS, type ProspectStatus } from '@/types/prospect'

const STATUS_STYLES: Record<ProspectStatus, string> = {
  to_contact: 'bg-slate-100 text-slate-600',
  contacted: 'bg-info-bg text-info-text',
  waiting: 'bg-warning-bg text-warning-text',
  follow_up: 'bg-primary-light text-primary',
  client: 'bg-success-bg text-success-text',
  refused: 'bg-danger-bg text-danger-text',
  ignored: 'bg-slate-200 text-slate-400',
}

export function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
