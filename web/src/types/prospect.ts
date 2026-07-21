export type ProspectStatus =
  | 'to_contact' | 'contacted' | 'waiting' | 'follow_up' | 'client' | 'refused' | 'ignored'

export const PROSPECT_STATUSES: ProspectStatus[] =
  ['to_contact', 'contacted', 'waiting', 'follow_up', 'client', 'refused', 'ignored']

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  to_contact: 'À contacter',
  contacted: 'Contacté',
  waiting: 'En attente',
  follow_up: 'Relance à prévoir',
  client: 'Client',
  refused: 'Refus',
  ignored: 'Ignoré',
}

export type ProspectPriority = 'low' | 'medium' | 'high'

export interface Prospect {
  id: string
  user_id: string
  place_id: string | null
  name: string
  category: string | null
  phone: string | null
  website: string | null
  email: string | null
  address: string | null
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  status: ProspectStatus
  score: number | null
  rating: number | null
  reviews: number | null
  google_maps_url: string | null
  has_booking: boolean | null
  booking_type: string | null
  has_instagram: boolean | null
  is_hot: boolean | null
  wasted_potential: boolean | null
  is_favorite: boolean
  notes: string | null
  is_seen: boolean
  is_validated: boolean
  first_seen_at: string
  last_seen_at: string
  photos: string[] | null
  opening_hours: OpeningHours | null
  reminder_at: string | null
  priority: ProspectPriority | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface OpeningHours {
  openNow: boolean | null
  weekdayText: string[]
}

// Raw lead shape returned by the `search` Supabase Edge Function.
export interface SearchLead {
  placeId: string
  name: string
  category: string | null
  types?: string[]
  address: string
  phone: string | null
  rating: number | null
  reviews: number
  website: string | null
  hasWebsite: boolean
  hasBooking: boolean
  bookingType: string
  hasInstagram: boolean
  googleMapsUrl: string
  imageUrl: string | null
  photos?: string[]
  openingHours?: OpeningHours | null
  lat: number | null
  lng: number | null
  distance: number | null
  score: number
  scoreLabel: 'hot' | 'medium' | 'low'
  isHot: boolean
  wastedPotential: boolean
}
