import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ProspectDetailPanel } from '@/components/ProspectDetailPanel'
import { StatusBadge } from '@/components/StatusBadge'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useDeleteProspect, useProspects, useRestoreProspect } from '@/hooks/useProspects'
import { PROSPECT_STATUSES, STATUS_LABELS, type Prospect, type ProspectStatus } from '@/types/prospect'

const TAB_STATUSES: Array<ProspectStatus | 'all'> = ['all', ...PROSPECT_STATUSES]
const TAB_LABELS: Record<ProspectStatus | 'all', string> = { all: 'Tous', ...STATUS_LABELS }

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

// Point 8: every prospect ever displayed in the feed lives here, regardless
// of status — unlike "Mes Prospects" this is the full consultation history,
// sorted by most recently (re)seen.
export default function HistoriquePage() {
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const filter = { status: statusFilter, favoritesOnly: false, search: debouncedSearch, orderBy: 'last_seen_at' as const }
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useProspects(filter)
  const deleteProspect = useDeleteProspect()
  const restoreProspect = useRestoreProspect()

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

  function onRestore() {
    if (!selected) return
    restoreProspect.mutate(selected.id)
    setSelected({ ...selected, is_seen: false })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold text-text">Historique</h1>
      <p className="mt-1 text-sm text-text-muted">Tous les prospects déjà consultés, avec la date de première et dernière consultation.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TAB_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-app border px-3 py-1.5 text-sm ${
              statusFilter === s ? 'border-primary bg-primary-light text-primary' : 'border-border-strong text-text-secondary hover:bg-bg'
            }`}
          >
            {TAB_LABELS[s]}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher (nom, adresse, tél, site, catégorie)…"
        className="mt-3 w-full rounded-app border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />

      {isLoading && <p className="mt-6 text-sm text-text-muted">Chargement…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="mt-6 text-sm text-text-muted">Aucun prospect consulté pour l'instant.</p>
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
              <div className="mt-0.5 text-xs text-text-muted">Vu le {formatDateTime(p.last_seen_at)}</div>
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
          onRestore={onRestore}
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
