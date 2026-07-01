let loadPromise: Promise<void> | null = null

// Loads the Google Maps JS SDK (places library) exactly once, no matter how
// many components ask for it.
export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=fr`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Impossible de charger Google Maps'))
    document.head.appendChild(script)
  })

  return loadPromise
}

declare global {
  interface Window {
    google?: typeof google
  }
}
