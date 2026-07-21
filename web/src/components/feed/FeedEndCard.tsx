interface FeedEndCardProps {
  empty: boolean
  onRefresh: () => void
}

export function FeedEndCard({ empty, onRefresh }: FeedEndCardProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl">{empty ? '🧭' : '🎉'}</div>
      <h1 className="text-xl font-semibold text-text">
        {empty ? 'Aucun commerce trouvé près de toi' : "Tu as vu tous les commerces à proximité"}
      </h1>
      <p className="max-w-xs text-sm text-text-secondary">
        {empty
          ? "Aucun établissement compatible trouvé dans la zone. Réessaie un peu plus tard ou depuis un autre endroit."
          : 'Reviens plus tard pour découvrir de nouveaux prospects, ou relance une exploration dès maintenant.'}
      </p>
      <button
        type="button"
        onClick={onRefresh}
        className="rounded-app bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-dark"
      >
        Rafraîchir
      </button>
    </div>
  )
}
