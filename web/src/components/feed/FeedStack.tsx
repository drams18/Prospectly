import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { useCallback, useEffect, useRef, useState, type WheelEvent } from 'react'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useFeedStore } from '@/store/feedStore'
import type { SearchLead } from '@/types/prospect'
import { FeedCard } from './FeedCard'

const DRAG_OFFSET_THRESHOLD = 100
const DRAG_VELOCITY_THRESHOLD = 500
const WHEEL_THRESHOLD = 24
const WHEEL_COOLDOWN_MS = 500
const TRANSITION_LOCK_MS = 320

const cardVariants = {
  enter: (dir: number) => ({ y: dir === 1 ? '100%' : '-100%', opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir === 1 ? '-100%' : '100%', opacity: 0 }),
}

interface FeedStackProps {
  leads: SearchLead[]
  savedIds: Set<string>
  onSave: (lead: SearchLead) => void
  onNeedMore: () => void
}

export function FeedStack({ leads, savedIds, onSave, onNeedMore }: FeedStackProps) {
  const currentIndex = useFeedStore((s) => s.currentIndex)
  const isTransitioning = useFeedStore((s) => s.isTransitioning)
  const goNext = useFeedStore((s) => s.goNext)
  const goPrevious = useFeedStore((s) => s.goPrevious)
  const setTransitioning = useFeedStore((s) => s.setTransitioning)
  const [direction, setDirection] = useState(1)
  const wheelLockRef = useRef(false)

  const current = leads[currentIndex]
  const next = leads[currentIndex + 1]

  const commit = useCallback((dir: 1 | -1) => {
    if (isTransitioning) return
    if (dir === -1 && currentIndex === 0) return
    setDirection(dir)
    setTransitioning(true)
    if (dir === 1) goNext(leads.length)
    else goPrevious()
    window.setTimeout(() => setTransitioning(false), TRANSITION_LOCK_MS)
  }, [isTransitioning, currentIndex, leads.length, goNext, goPrevious, setTransitioning])

  // Prefetch the data for upcoming bands well before the user reaches the
  // end, and warm the image cache for the next couple of cards so swiping
  // never waits on either the network or a photo pop-in.
  useEffect(() => {
    if (currentIndex >= leads.length - 3) onNeedMore()
  }, [currentIndex, leads.length, onNeedMore])

  useEffect(() => {
    for (const offset of [1, 2]) {
      const url = leads[currentIndex + offset]?.photos?.[0]
      if (url) new Image().src = url
    }
  }, [currentIndex, leads])

  useHotkeys({
    ArrowDown: () => commit(1),
    ArrowUp: () => commit(-1),
  }, [commit])

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    if (wheelLockRef.current || Math.abs(e.deltaY) < WHEEL_THRESHOLD) return
    wheelLockRef.current = true
    commit(e.deltaY > 0 ? 1 : -1)
    window.setTimeout(() => { wheelLockRef.current = false }, WHEEL_COOLDOWN_MS)
  }

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y < -DRAG_OFFSET_THRESHOLD || info.velocity.y < -DRAG_VELOCITY_THRESHOLD) {
      commit(1)
    } else if (currentIndex > 0 && (info.offset.y > DRAG_OFFSET_THRESHOLD || info.velocity.y > DRAG_VELOCITY_THRESHOLD)) {
      commit(-1)
    }
  }

  if (!current) return null

  return (
    <div className="relative h-full w-full overflow-hidden overscroll-y-contain" onWheel={handleWheel}>
      {next && (
        <div className="absolute inset-0 scale-[0.94] opacity-70" aria-hidden>
          <FeedCard lead={next} saved={savedIds.has(next.placeId)} interactive={false} />
        </div>
      )}

      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={current.placeId}
          custom={direction}
          variants={cardVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.55}
          onDragEnd={handleDragEnd}
          className="absolute inset-0"
        >
          <FeedCard
            lead={current}
            saved={savedIds.has(current.placeId)}
            interactive
            onSave={() => onSave(current)}
            onSkip={() => commit(1)}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
