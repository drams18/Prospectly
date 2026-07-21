import type { GeolocationStatus } from '@/hooks/useGeolocation'

interface GeolocationGateProps {
  status: GeolocationStatus
  onRetry: () => void
}

export function GeolocationGate({ status, onRetry }: GeolocationGateProps) {
  const unavailable = status === 'unavailable'

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl">📍</div>
      <h1 className="text-xl font-semibold text-text">Active ta position</h1>
      <p className="max-w-xs text-sm text-text-secondary">
        {unavailable
          ? "Ton navigateur ne permet pas d'accéder à ta position. Essaie depuis un autre navigateur ou appareil."
          : 'Prospectly a besoin de ta position pour te montrer les commerces à prospecter autour de toi — aucune saisie manuelle nécessaire.'}
      </p>
      {status === 'denied' && (
        <p className="max-w-xs text-xs text-text-muted">
          La permission a été refusée. Autorise la localisation dans les réglages de ton navigateur puis réessaie.
        </p>
      )}
      {!unavailable && (
        <button
          type="button"
          onClick={onRetry}
          disabled={status === 'loading'}
          className="rounded-app bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {status === 'loading' ? 'Localisation…' : 'Activer ma position'}
        </button>
      )}
    </div>
  )
}
