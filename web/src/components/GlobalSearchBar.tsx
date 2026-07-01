import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGlobalSearch } from '@/hooks/useGlobalSearch'
import { StatusBadge } from './StatusBadge'

export function GlobalSearchBar() {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { data, isFetching } = useGlobalSearch(term)

  function goTo(id: string) {
    setOpen(false)
    setTerm('')
    navigate(`/prospects?open=${id}`)
  }

  return (
    <div className="relative w-full max-w-sm">
      <input
        ref={inputRef}
        id="global-search-input"
        value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Rechercher un commerce… (nom, adresse, tél, site)"
        className="w-full rounded-app border border-border-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
      />
      {open && term.trim().length >= 2 && (
        <div className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-app border border-border bg-surface shadow-md">
          {isFetching && <div className="px-3 py-2 text-sm text-text-muted">Recherche…</div>}
          {!isFetching && data?.rows.length === 0 && (
            <div className="px-3 py-2 text-sm text-text-muted">Aucun résultat</div>
          )}
          {data?.rows.map((p) => (
            <button
              key={p.id}
              onMouseDown={() => goTo(p.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-bg"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-text">{p.name}</span>
                <span className="block truncate text-xs text-text-muted">{p.address}</span>
              </span>
              <StatusBadge status={p.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
