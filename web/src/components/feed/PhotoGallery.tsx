import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { FALLBACK_IMAGE } from '@/utils/leadPresentation'

interface PhotoGalleryProps {
  photos: string[]
  alt: string
  interactive: boolean
}

// Instagram Stories-style pager: left/right tap zones instead of a second
// drag axis, so it never fights the feed's outer vertical swipe gesture.
export function PhotoGallery({ photos, alt, interactive }: PhotoGalleryProps) {
  const [index, setIndex] = useState(0)
  const slides = photos.length > 0 ? photos : [FALLBACK_IMAGE]
  const safeIndex = Math.min(index, slides.length - 1)

  return (
    <div className="absolute inset-0 overflow-hidden bg-bg">
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={safeIndex}
          src={slides[safeIndex]}
          alt={alt}
          loading="eager"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="h-full w-full object-cover"
        />
      </AnimatePresence>

      {slides.length > 1 && (
        <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
          {slides.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i === safeIndex ? 'bg-white' : 'bg-white/35'}`} />
          ))}
        </div>
      )}

      {interactive && slides.length > 1 && (
        <div className="absolute inset-0 z-10 flex">
          <motion.button
            aria-label="Photo précédente"
            className="h-full w-2/5"
            onTap={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
          />
          <div className="w-1/5" />
          <motion.button
            aria-label="Photo suivante"
            className="h-full w-2/5"
            onTap={() => setIndex((i) => (i + 1) % slides.length)}
          />
        </div>
      )}
    </div>
  )
}
