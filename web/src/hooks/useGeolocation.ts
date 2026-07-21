import { useEffect, useRef, useState } from 'react'
import { useFeedStore } from '@/store/feedStore'

export type GeolocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'

const OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }

/**
 * One-shot browser geolocation, captured once per session into feedStore so
 * every subsequent feed request reuses the exact same coordinates (GPS
 * jitter between reads would otherwise shift the ring-diff math server-side).
 * Ref-guarded against React 19 StrictMode's dev double-invoke of effects.
 */
export function useGeolocation() {
  const coords = useFeedStore((s) => s.coords)
  const setCoords = useFeedStore((s) => s.setCoords)
  const [status, setStatus] = useState<GeolocationStatus>(coords ? 'granted' : 'idle')
  const requested = useRef(false)

  function request() {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
        setStatus('granted')
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      OPTIONS,
    )
  }

  useEffect(() => {
    if (coords) return
    if (requested.current) return
    requested.current = true
    request()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { status, retry: request }
}
