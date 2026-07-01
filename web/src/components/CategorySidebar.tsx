import { CATEGORY_GROUPS, type Category } from '@/data/categories'

interface CategorySidebarProps {
  counts: Record<string, number>
  activeCategoryId: string | null
  onSelect: (category: Category) => void
}

export function CategorySidebar({ counts, activeCategoryId, onSelect }: CategorySidebarProps) {
  return (
    <div className="space-y-5">
      {CATEGORY_GROUPS.map((group) => (
        <div key={group.id}>
          <div className="mb-2 text-xs font-semibold tracking-wide text-text-muted">{group.label}</div>
          <div className="space-y-1">
            {group.categories.map((cat) => {
              const count = counts[cat.id] ?? 0
              const isActive = activeCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => onSelect(cat)}
                  className={`flex w-full items-center justify-between rounded-app px-3 py-2 text-sm ${
                    isActive ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-bg'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="text-xs text-text-muted">{count > 0 ? count : '—'}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
