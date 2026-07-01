import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CategorySidebar } from '@/components/CategorySidebar'
import { ConfirmModal } from '@/components/ConfirmModal'
import { LocationInput } from '@/components/LocationInput'
import { ProspectCard } from '@/components/ProspectCard'
import { ProspectDetailPanel } from '@/components/ProspectDetailPanel'
import type { Category } from '@/data/categories'
import { useDeleteProspect } from '@/hooks/useProspects'
import { useCategorySearch, useMarkSeen, useZoneSearch } from '@/hooks/useSearch'
import { useAuth } from '@/lib/AuthProvider'
import { addSearchHistory, listSearchHistory, removeSearchHistory } from '@/services/searchHistory'
import type { Prospect, SearchLead } from '@/types/prospect'

export default function SearchPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''

  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const zoneSearch = useZoneSearch()
  const categorySearch = useCategorySearch()
  const markSeen = useMarkSeen()
  const deleteProspect = useDeleteProspect()

  const { data: history } = useQuery({
    queryKey: ['search-history', userId],
    queryFn: () => listSearchHistory(userId),
    enabled: !!userId,
  })

  async function runZoneSearch(loc: string, lat?: number, lng?: number) {
    if (!loc.trim()) return
    setActiveCategory(null)
    categorySearch.reset()
    await zoneSearch.mutateAsync({ location: loc, lat, lng })
    if (userId) {
      await addSearchHistory(userId, loc)
      queryClient.invalidateQueries({ queryKey: ['search-history', userId] })
    }
  }

  function onPlaceSelected(loc: string, lat: number, lng: number) {
    setCoords({ lat, lng })
    setLocation(loc)
  }

  function onSubmit() {
    runZoneSearch(location, coords?.lat, coords?.lng)
  }

  function onSelectCategory(cat: Category) {
    setActiveCategory(cat)
    categorySearch.mutate({ location, lat: coords?.lat, lng: coords?.lng, keywords: cat.keywords })
  }

  function onOpenLead(lead: SearchLead) {
    markSeen.mutate(lead, { onSuccess: (prospect) => setSelectedProspect(prospect) })
  }

  async function onRemoveHistory(loc: string) {
    if (!userId) return
    await removeSearchHistory(userId, loc)
    queryClient.invalidateQueries({ queryKey: ['search-history', userId] })
  }

  const results = categorySearch.data?.results ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">Explorer une zone</h1>
        <p className="mt-1 text-sm text-text-secondary">Choisissez une zone, explorez les opportunités par secteur.</p>
      </header>

      <div className="mt-4 flex gap-2">
        <div className="flex-1">
          <LocationInput value={location} onChange={setLocation} onPlaceSelected={onPlaceSelected} onSubmit={onSubmit} />
        </div>
        <button
          onClick={onSubmit}
          disabled={!location.trim() || zoneSearch.isPending}
          className="rounded-app bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {zoneSearch.isPending ? 'Analyse…' : 'Explorer la zone'}
        </button>
      </div>

      {!!history?.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {history.map((loc) => (
            <span key={loc} className="flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs text-text-secondary">
              <button onClick={() => { setLocation(loc); setCoords(null); runZoneSearch(loc) }}>{loc}</button>
              <button onClick={() => onRemoveHistory(loc)} className="text-text-muted hover:text-danger-text">×</button>
            </span>
          ))}
        </div>
      )}

      {zoneSearch.isError && <p className="mt-3 text-sm text-danger-text">{(zoneSearch.error as Error).message}</p>}

      {zoneSearch.data && (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
          <aside className="rounded-app-lg border border-border bg-surface p-4">
            <CategorySidebar counts={zoneSearch.data} activeCategoryId={activeCategory?.id ?? null} onSelect={onSelectCategory} />
          </aside>

          <div>
            {categorySearch.isPending && <p className="text-sm text-text-muted">Recherche en cours…</p>}
            {categorySearch.isError && <p className="text-sm text-danger-text">{(categorySearch.error as Error).message}</p>}
            {!categorySearch.isPending && activeCategory && (
              <p className="mb-3 text-sm text-text-muted">{results.length} prospect{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''} — {activeCategory.label}</p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((lead) => (
                <ProspectCard key={lead.placeId} lead={lead} onOpen={() => onOpenLead(lead)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedProspect && (
        <ProspectDetailPanel
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onDelete={() => setPendingDeleteId(selectedProspect.id)}
        />
      )}

      <ConfirmModal
        open={!!pendingDeleteId}
        title="Supprimer ce prospect ?"
        message="Cette action est irréversible."
        critical
        onConfirm={() => {
          if (pendingDeleteId) deleteProspect.mutate(pendingDeleteId)
          setSelectedProspect(null)
          setPendingDeleteId(null)
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  )
}
