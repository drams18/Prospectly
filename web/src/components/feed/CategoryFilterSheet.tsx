import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CATEGORY_GROUPS, type CategoryGroup } from '@/data/categories'
import { fetchFeedCategoryCounts } from '@/services/feed'

interface Coords {
  lat: number
  lng: number
}

interface CategoryFilterSheetProps {
  open: boolean
  onClose: () => void
  selectedCategoryIds: string[]
  onChange: (categoryIds: string[]) => void
  coords: Coords | null
}

export function CategoryFilterSheet({ open, onClose, selectedCategoryIds, onChange, coords }: CategoryFilterSheetProps) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())

  if (!open) return null

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  function toggleCategory(categoryId: string) {
    onChange(
      selectedCategoryIds.includes(categoryId)
        ? selectedCategoryIds.filter((id) => id !== categoryId)
        : [...selectedCategoryIds, categoryId],
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full flex-col rounded-t-app-lg bg-surface shadow-xl sm:max-w-md sm:rounded-app-lg">
        <div className="flex items-center justify-between border-b border-border-strong px-5 py-4">
          <h2 className="text-lg font-semibold text-text">Catégories</h2>
          <button type="button" onClick={onClose} className="text-sm text-text-secondary hover:text-text">
            Fermer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <button
            type="button"
            onClick={() => onChange([])}
            className={`mb-3 w-full rounded-app border px-4 py-2.5 text-left text-sm font-medium ${
              selectedCategoryIds.length === 0
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border-strong text-text hover:bg-bg'
            }`}
          >
            Tous les commerces
          </button>

          {CATEGORY_GROUPS.map((group) => (
            <CategoryGroupSection
              key={group.id}
              group={group}
              expanded={expandedGroupIds.has(group.id)}
              onToggleExpand={() => toggleGroup(group.id)}
              selectedCategoryIds={selectedCategoryIds}
              onToggleCategory={toggleCategory}
              coords={coords}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface CategoryGroupSectionProps {
  group: CategoryGroup
  expanded: boolean
  onToggleExpand: () => void
  selectedCategoryIds: string[]
  onToggleCategory: (categoryId: string) => void
  coords: Coords | null
}

function CategoryGroupSection({
  group, expanded, onToggleExpand, selectedCategoryIds, onToggleCategory, coords,
}: CategoryGroupSectionProps) {
  const activeInGroup = group.categories.filter((c) => selectedCategoryIds.includes(c.id)).length

  const { data: counts } = useQuery({
    queryKey: ['category-counts', group.id, coords?.lat.toFixed(4), coords?.lng.toFixed(4)],
    queryFn: () => fetchFeedCategoryCounts({ lat: coords!.lat, lng: coords!.lng, groupId: group.id }),
    enabled: expanded && !!coords,
    staleTime: 10 * 60_000,
  })

  return (
    <div className="border-b border-border-strong last:border-b-0">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <span className="text-xs font-semibold tracking-wide text-text-secondary">
          {group.label}
          {activeInGroup > 0 && <span className="ml-1.5 text-primary">({activeInGroup})</span>}
        </span>
        <span className="text-text-secondary">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 pb-3">
          {group.categories.map((category) => {
            const checked = selectedCategoryIds.includes(category.id)
            const count = counts?.[category.id]
            return (
              <label
                key={category.id}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-app px-2 py-1.5 text-sm hover:bg-bg"
              >
                <span className="flex items-center gap-2 text-text">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCategory(category.id)}
                    className="h-4 w-4 rounded border-border-strong accent-primary"
                  />
                  {category.label}
                </span>
                {count != null && <span className="text-xs text-text-secondary">{count}</span>}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
