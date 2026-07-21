interface CategoryFilterButtonProps {
  activeCount: number
  onClick: () => void
}

export function CategoryFilterButton({ activeCount, onClick }: CategoryFilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed left-4 top-4 z-30 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-text shadow-sm backdrop-blur-sm hover:bg-white"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      <span>Filtrer</span>
      {activeCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
          {activeCount}
        </span>
      )}
    </button>
  )
}
