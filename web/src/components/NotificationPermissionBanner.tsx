import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthProvider'
import { getPermissionState, isIos, isPushSupported, isStandalone, subscribeToPush } from '@/lib/push'

const DISMISS_KEY = 'prospectly_notif_banner_dismissed'

// Point 8: ask cleanly on first launch, only via an explicit user gesture
// (Safari/iOS requires this — Notification.requestPermission() must be
// triggered by a real click, never called automatically on page load).
export function NotificationPermissionBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (dismissed || !user) return
    setVisible(isPushSupported() && getPermissionState() === 'default' && (!isIos() || isStandalone()))
  }, [dismissed, user])

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  async function enable() {
    if (!user) return
    const ok = await subscribeToPush(user.id)
    if (ok) dismiss()
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 border-b border-border bg-primary-light px-4 py-3 text-sm">
      <span className="text-primary">🔔 Active les notifications pour ne rater aucun rappel, même app fermée.</span>
      <div className="flex flex-none gap-2">
        <button onClick={enable} className="rounded-app bg-primary px-3 py-1.5 font-medium text-white">Activer</button>
        <button onClick={dismiss} className="rounded-app border border-border-strong px-3 py-1.5 text-text-secondary hover:bg-bg">Plus tard</button>
      </div>
    </div>
  )
}

// Point 7: on iPhone, push only works from a PWA added to the home screen
// (Apple's constraint) — a plain Safari tab can grant permission but will
// never actually receive anything while closed. Guide the user there first.
export function IosInstallBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(`${DISMISS_KEY}_ios`) === '1')

  if (dismissed || !isIos() || isStandalone()) return null

  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 border-b border-border bg-warning-bg px-4 py-3 text-sm">
      <span className="text-warning-text">📲 Pour recevoir les rappels sur iPhone : Partager → "Sur l'écran d'accueil".</span>
      <button
        onClick={() => { localStorage.setItem(`${DISMISS_KEY}_ios`, '1'); setDismissed(true) }}
        className="flex-none rounded-app border border-border-strong px-3 py-1.5 text-text-secondary hover:bg-bg"
      >
        Compris
      </button>
    </div>
  )
}
