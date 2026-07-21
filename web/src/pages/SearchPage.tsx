import { SwipeFeed } from '@/components/feed/SwipeFeed'

export default function SearchPage() {
  return (
    <div className="h-[calc(100dvh-64px)] w-full overscroll-y-contain">
      <SwipeFeed />
    </div>
  )
}
