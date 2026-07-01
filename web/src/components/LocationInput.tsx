import { useEffect, useRef } from 'react'
import { loadGoogleMapsScript } from '@/lib/googleMaps'

interface LocationInputProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelected: (location: string, lat: number, lng: number) => void
  onSubmit: () => void
}

export function LocationInput({ value, onChange, onPlaceSelected, onSubmit }: LocationInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_JS_KEY
    if (!apiKey || !inputRef.current) return

    let cancelled = false
    loadGoogleMapsScript(apiKey).then(() => {
      if (cancelled || !inputRef.current || !window.google) return
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'fr' },
        fields: ['formatted_address', 'geometry', 'name'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const lat = place.geometry?.location?.lat()
        const lng = place.geometry?.location?.lng()
        const location = place.formatted_address ?? place.name ?? ''
        if (lat != null && lng != null && location) {
          onChange(location)
          onPlaceSelected(location, lat, lng)
        }
      })
      autocompleteRef.current = autocomplete
    }).catch((err) => console.error(err))

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit() } }}
      placeholder="Ville, quartier, code postal (ex: Paris 11e, Bastille…)"
      autoFocus
      autoComplete="off"
      className="w-full rounded-app border border-border-strong px-4 py-3 text-sm focus:border-primary focus:outline-none"
    />
  )
}
