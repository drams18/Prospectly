import { useLayoutEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmModal } from '@/components/ConfirmModal'
import { LeadPreviewPanel } from '@/components/LeadPreviewPanel'
import { LocationInput } from '@/components/LocationInput'
import { ProspectCard } from '@/components/ProspectCard'
import { ProspectDetailPanel } from '@/components/ProspectDetailPanel'
import { CATEGORY_GROUPS } from '@/data/categories'
import { useDeleteProspect } from '@/hooks/useProspects'
import { useCategorySearch, useSaveLead } from '@/hooks/useSearch'
import { useAuth } from '@/lib/AuthProvider'
import { addSearchHistory, listSearchHistory, removeSearchHistory } from '@/services/searchHistory'
import { useSearchStore } from '@/store/searchStore'
import type { Prospect, SearchLead } from '@/types/prospect'

const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.categories)

export default function SearchPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''

  const location = useSearchStore(s => s.location)
  const coords = useSearchStore(s => s.coords)
  const categoryId = useSearchStore(s => s.categoryId)
  const noWebsite = useSearchStore(s => s.noWebsite)
  const noBooking = useSearchStore(s => s.noBooking)
  const submittedSearch = useSearchStore(s => s.submittedSearch)
  const savedIds = useSearchStore(s => s.savedIds)
  const setLocation = useSearchStore(s => s.setLocation)
  const setCoords = useSearchStore(s => s.setCoords)
  const setCategoryId = useSearchStore(s => s.setCategoryId)
  const setNoWebsite = useSearchStore(s => s.setNoWebsite)
  const setNoBooking = useSearchStore(s => s.setNoBooking)
  const submitSearch = useSearchStore(s => s.submitSearch)
  const markSaved = useSearchStore(s => s.markSaved)

  const [selectedLead, setSelectedLead] = useState<SearchLead | null>(null)
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const categorySearch = useCategorySearch(submittedSearch)
  const saveLead = useSaveLead()
  const deleteProspect = useDeleteProspect()

  const { data: history } = useQuery({
    queryKey: ['search-history', userId],
    queryFn: () => listSearchHistory(userId),
    enabled: !!userId,
  })

  // Restore the list scroll position synchronously (before paint) so returning
  // to Explorer never shows a visible jump back to the top.
  useLayoutEffect(() => {
    window.scrollTo(0, useSearchStore.getState().scrollY)

    function handleScroll() {
      useSearchStore.setState({ scrollY: window.scrollY })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  function onPlaceSelected(loc: string, lat: number, lng: number) {
    setCoords({ lat, lng })
    setLocation(loc)
  }

  async function onSubmit() {
    if (!location.trim()) return
    const category = ALL_CATEGORIES.find(c => c.id === categoryId)
    if (!category) return

    submitSearch({
      location, lat: coords?.lat, lng: coords?.lng,
      keywords: category.keywords, categoryLabel: category.label,
      hasWebsite: noWebsite ? false : undefined,
      hasBooking: noBooking ? false : undefined,
    })

    if (userId) {
      await addSearchHistory(userId, location)
      queryClient.invalidateQueries({ queryKey: ['search-history', userId] })
    }
  }

  function onSave(lead: SearchLead) {
    saveLead.mutate(lead, { onSuccess: () => markSaved(lead.placeId) })
  }

  async function onRemoveHistory(loc: string) {
    if (!userId) return
    await removeSearchHistory(userId, loc)
    queryClient.invalidateQueries({ queryKey: ['search-history', userId] })
  }

  const results = categorySearch.data?.results ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">Explorer</h1>
      </header>

      <div className="mt-4 space-y-3">
        <LocationInput value={location} onChange={setLocation} onPlaceSelected={onPlaceSelected} onSubmit={onSubmit} />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-app border border-border-strong px-3 py-3 text-sm focus:border-primary focus:outline-none"
        >
          {CATEGORY_GROUPS.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={noWebsite} onChange={(e) => setNoWebsite(e.target.checked)} />
            Sans site web
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={noBooking} onChange={(e) => setNoBooking(e.target.checked)} />
            Sans réservation en ligne
          </label>
        </div>

        <button
          onClick={onSubmit}
          disabled={!location.trim() || categorySearch.isFetching}
          className="w-full rounded-app bg-primary px-5 py-3 text-base font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {categorySearch.isFetching ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>

      {!!history?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[...new Set(history)].map((loc) => (
            <span key={loc} className="flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs text-text-secondary">
              <button onClick={() => setLocation(loc)}>{loc}</button>
              <button onClick={() => onRemoveHistory(loc)} className="text-text-muted hover:text-danger-text">×</button>
            </span>
          ))}
        </div>
      )}

      {categorySearch.isError && <p className="mt-3 text-sm text-danger-text">{(categorySearch.error as Error).message}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {results.map((lead) => (
          <ProspectCard
            key={lead.placeId}
            lead={lead}
            saved={savedIds.has(lead.placeId)}
            onOpen={() => setSelectedLead(lead)}
            onSave={() => onSave(lead)}
          />
        ))}
      </div>

      {selectedLead && (
        <LeadPreviewPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSaved={(saved) => {
            markSaved(selectedLead.placeId)
            setSelectedLead(null)
            setSelectedProspect(saved)
          }}
        />
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
