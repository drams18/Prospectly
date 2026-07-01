interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  critical?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ open, title, message, critical, onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-app-lg bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-app border border-border-strong px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-app px-4 py-2 text-sm font-medium text-white ${critical ? 'bg-danger-text hover:opacity-90' : 'bg-primary hover:bg-primary-dark'}`}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}
