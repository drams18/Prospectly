import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ProspectDetailPanel } from '@/components/ProspectDetailPanel'
import { StatusBadge } from '@/components/StatusBadge'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useDeleteProspect, useProspectCounts, useProspects } from '@/hooks/useProspects'
import { PROSPECT_STATUSES, STATUS_LABELS, type Prospect, type ProspectStatus } from '@/types/prospect'

const TAB_STATUSES: Array<ProspectStatus | 'all'> = ['all', ...PROSPECT_STATUSES]
const TAB_LABELS: Record<ProspectStatus | 'all', string> = { all: 'Tous', ...STATUS_LABELS }

export default function ProspectsPage() {
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const filter = { status: statusFilter, favoritesOnly, validatedOnly: true, search: debouncedSearch }
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useProspects(filter)
  const { data: counts } = useProspectCounts()
  const deleteProspect = useDeleteProspect()

  const rows = useMemo(() => data?.pages.flatMap(p => p.rows) ?? [], [data])

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useHotkeys({
    Escape: () => { setSelected(null); setPendingDeleteId(null) },
  }, [])

  function confirmDelete() {
    if (!pendingDeleteId) return
    deleteProspect.mutate(pendingDeleteId)
    if (selected?.id === pendingDeleteId) setSelected(null)
    setPendingDeleteId(null)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold text-text">Mes Prospects</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {TAB_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-app border px-3 py-1.5 text-sm ${
              statusFilter === status ? 'border-primary bg-primary-light text-primary' : 'border-border-strong text-text-secondary hover:bg-bg'
            }`}
          >
            {TAB_LABELS[status]}
            {status !== 'all' && counts?.[status] ? ` (${counts[status]})` : ''}
          </button>
        ))}
        <button
          onClick={() => setFavoritesOnly(v => !v)}
          className={`rounded-app border px-3 py-1.5 text-sm ${
            favoritesOnly ? 'border-warning-text bg-warning-bg text-warning-text' : 'border-border-strong text-text-secondary hover:bg-bg'
          }`}
        >
          ★ Favoris
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher (nom, adresse, tél, site, catégorie)…"
        className="mt-3 w-full rounded-app border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />

      {isLoading && <p className="mt-6 text-sm text-text-muted">Chargement…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="mt-6 text-sm text-text-muted">Aucun prospect.</p>
      )}

      <div className="mt-4 space-y-2">
        {rows.map((p) => (
          <div
            key={p.id}
            onClick={() => setSelected(p)}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-app-lg border border-border bg-surface px-4 py-3 hover:shadow-sm"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-text">{p.is_favorite ? '★ ' : ''}{p.name}</div>
              {p.category && <div className="truncate text-sm text-text-secondary">{p.category}</div>}
            </div>
            <StatusBadge status={p.status} />
          </div>
        ))}
        <div ref={sentinelRef} className="h-4" />
        {isFetchingNextPage && <p className="py-3 text-center text-sm text-text-muted">Chargement…</p>}
      </div>

      {selected && (
        <ProspectDetailPanel
          prospect={rows.find(r => r.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
          onDelete={() => setPendingDeleteId(selected.id)}
        />
      )}

      <ConfirmModal
        open={!!pendingDeleteId}
        title="Supprimer ce prospect ?"
        message="Cette action est irréversible."
        critical
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  )
}
