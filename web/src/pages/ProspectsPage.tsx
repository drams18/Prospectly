import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ProspectDetailPanel } from '@/components/ProspectDetailPanel'
import { StatusBadge } from '@/components/StatusBadge'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useDeleteProspect, useProspectCounts, useProspects } from '@/hooks/useProspects'
import { getProspectById } from '@/services/prospects'
import type { ProspectSort } from '@/services/prospects'
import { PROSPECT_STATUSES, STATUS_LABELS, type Prospect, type ProspectStatus } from '@/types/prospect'

interface ProspectsPageProps {
  forcedStatus?: ProspectStatus
  title?: string
}

const TAB_STATUSES: Array<ProspectStatus | 'all'> = ['all', ...PROSPECT_STATUSES]

export default function ProspectsPage({ forcedStatus, title }: ProspectsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>(forcedStatus ?? 'all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<ProspectSort>('updated_desc')
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const filter = { status: forcedStatus ?? statusFilter, favoritesOnly, search, sort }
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useProspects(filter)
  const { data: counts } = useProspectCounts()
  const deleteProspect = useDeleteProspect()

  const rows = useMemo(() => data?.pages.flatMap(p => p.rows) ?? [], [data])

  // Deep link from the global search bar: /prospects?open=<id>
  const openId = searchParams.get('open')
  const { data: linkedProspect } = useQuery({
    queryKey: ['prospect', openId],
    queryFn: () => getProspectById(openId!),
    enabled: !!openId,
  })
  useEffect(() => {
    if (linkedProspect) {
      setSelected(linkedProspect)
      searchParams.delete('open')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedProspect])

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
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-semibold text-text">{title ?? 'Mon Parcours'}</h1>

      {!forcedStatus && (
        <div className="mt-4 flex flex-wrap gap-2">
          {TAB_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-app border px-3 py-1.5 text-sm ${
                statusFilter === status ? 'border-primary bg-primary-light text-primary' : 'border-border-strong text-text-secondary hover:bg-bg'
              }`}
            >
              {status === 'all' ? 'Tous' : STATUS_LABELS[status]}
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
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, adresse, tél, site, catégorie)…"
          className="min-w-64 flex-1 rounded-app border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as ProspectSort)}
          className="rounded-app border border-border-strong px-3 py-2 text-sm"
        >
          <option value="updated_desc">Dernière modification</option>
          <option value="created_desc">Date d'ajout</option>
          <option value="name_asc">Nom</option>
          <option value="score_desc">Score</option>
        </select>
        {forcedStatus && (
          <button
            onClick={() => setFavoritesOnly(v => !v)}
            className={`rounded-app border px-3 py-1.5 text-sm ${
              favoritesOnly ? 'border-warning-text bg-warning-bg text-warning-text' : 'border-border-strong text-text-secondary hover:bg-bg'
            }`}
          >
            ★ Favoris
          </button>
        )}
      </div>

      {isLoading && <p className="mt-6 text-sm text-text-muted">Chargement…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="mt-6 text-sm text-text-muted">Aucun prospect dans cette catégorie.</p>
      )}

      <div className="mt-4 overflow-x-auto rounded-app-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-bg text-xs uppercase text-text-muted">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Adresse</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Ajouté</th>
              <th className="px-4 py-3">Modifié</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-bg" onClick={() => setSelected(p)}>
                <td className="px-4 py-3 font-medium text-text">{p.is_favorite ? '★ ' : ''}{p.name}</td>
                <td className="max-w-56 truncate px-4 py-3 text-text-secondary">{p.address}</td>
                <td className="px-4 py-3 text-text-secondary">{p.phone ?? '—'}</td>
                <td className="max-w-40 truncate px-4 py-3 text-text-secondary">{p.website ?? '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{p.category ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-text-muted">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="whitespace-nowrap px-4 py-3 text-text-muted">{new Date(p.updated_at).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingDeleteId(p.id) }}
                    className="text-danger-text hover:underline"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
