export type ProspectStatus =
  | 'new'
  | 'seen'
  | 'contacted'
  | 'appointment'
  | 'client'
  | 'refused'
  | 'follow_up'

export const PROSPECT_STATUSES: ProspectStatus[] = [
  'new', 'seen', 'contacted', 'appointment', 'client', 'refused', 'follow_up',
]

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  new: 'Nouveau',
  seen: 'Déjà vu',
  contacted: 'Contacté',
  appointment: 'Rendez-vous pris',
  client: 'Client',
  refused: 'Refus',
  follow_up: 'À relancer',
}

// Statuses that should hide a business from fresh area/category searches —
// anything the user has already interacted with.
export const PROCESSED_STATUSES: ProspectStatus[] = PROSPECT_STATUSES.filter(s => s !== 'new')

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
  created_at: string
  updated_at: string
}

export interface ProspectHistoryEntry {
  id: string
  prospect_id: string
  user_id: string
  action: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

// Raw lead shape returned by the `search` Supabase Edge Function.
export interface SearchLead {
  placeId: string
  name: string
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
  lat: number | null
  lng: number | null
  distance: number | null
  score: number
  scoreLabel: 'hot' | 'medium' | 'low'
  isHot: boolean
  wastedPotential: boolean
  instaDependent: boolean
}
