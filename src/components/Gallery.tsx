import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import type { RoomPhoto } from '../lib/types'
import { Photo } from './ui'

/** Galerie interactive : vignettes + affichage plein écran avec navigation clavier. */
export function Gallery({ photos, title }: { photos: Pick<RoomPhoto, 'id' | 'url'>[]; title: string }) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)

  const move = useCallback(
    (d: number) => setIndex((i) => (photos.length ? (i + d + photos.length) % photos.length : 0)),
    [photos.length],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowRight') move(1)
      if (e.key === 'ArrowLeft') move(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, move])

  if (!photos.length) {
    return <Photo alt={title} className="h-72 md:h-[26rem] rounded-2xl" fallbackLabel={title} zoom={false} />
  }

  return (
    <div>
      <button className="group block w-full rounded-2xl overflow-hidden" onClick={() => setOpen(true)} aria-label="Agrandir la photo">
        <Photo src={photos[index].url} alt={`${title} — photo ${index + 1}`} className="h-72 md:h-[26rem]" />
      </button>
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              className={`shrink-0 rounded-lg overflow-hidden border-2 ${i === index ? 'border-gold' : 'border-transparent'}`}
              aria-label={`Voir la photo ${i + 1}`}
            >
              <Photo src={p.url} alt="" className="h-16 w-24" zoom={false} />
            </button>
          ))}
        </div>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Galerie ${title}`}
            onClick={() => setOpen(false)}
          >
            <img
              src={photos[index].url}
              alt={`${title} — photo ${index + 1}`}
              className="max-h-[88vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {photos.length > 1 && (
              <>
                <button
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gold text-4xl px-3"
                  onClick={(e) => {
                    e.stopPropagation()
                    move(-1)
                  }}
                  aria-label="Photo précédente"
                >
                  ‹
                </button>
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gold text-4xl px-3"
                  onClick={(e) => {
                    e.stopPropagation()
                    move(1)
                  }}
                  aria-label="Photo suivante"
                >
                  ›
                </button>
              </>
            )}
            <button className="absolute right-4 top-4 text-gold text-3xl" onClick={() => setOpen(false)} aria-label="Fermer">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
