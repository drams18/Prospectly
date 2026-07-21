export const FALLBACK_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <rect width="800" height="450" fill="#f1f5f9"/>
    <circle cx="400" cy="185" r="36" fill="#94a3b8"/>
    <rect x="280" y="260" width="240" height="16" rx="8" fill="#94a3b8"/>
    <rect x="320" y="286" width="160" height="12" rx="6" fill="#cbd5e1"/>
  </svg>`
)

export const BADGE: Record<'hot' | 'medium' | 'low', { emoji: string; label: string }> = {
  hot: { emoji: '🔥', label: 'Excellent prospect' },
  medium: { emoji: '🟡', label: 'Bon prospect' },
  low: { emoji: '⚪', label: 'Faible potentiel' },
}
