import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { adaptiveImageUrl } from '@/shared/lib/adaptiveImage'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/shared/ui/icons'

/** `--dur-fast` (`index.css`) in framer's seconds — keep the two in step. */
const DUR_FAST_S = 0.22
const AUTOPLAY_MS = 3500

/**
 * Detail-page gallery: one large frame plus thumbnails, with arrow navigation and autoplay.
 *
 * Autoplay only runs on this in-page frame — never inside the lightbox, which is manual-only by
 * design (a photo the visitor deliberately opened full-screen shouldn't keep moving under them).
 * It pauses on hover, under `prefers-reduced-motion`, with fewer than two photos, or while the
 * lightbox is open (the frame is hidden behind it, so advancing it would be wasted work that also
 * desyncs the two views' active index).
 */
export function TourGallery({ images, alt }: { images: readonly string[]; alt: string }) {
  const [active, setActive] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const shown = images.length > 0 ? images : ['']
  const hasMultiple = shown.length > 1
  const reducedMotion = useReducedMotion()
  const { t } = useLocale()

  const goTo = (index: number) => setActive(((index % shown.length) + shown.length) % shown.length)
  const next = () => goTo(active + 1)
  const prev = () => goTo(active - 1)

  useEffect(() => {
    if (!hasMultiple || hovering || lightboxOpen || reducedMotion) return
    const id = window.setInterval(() => setActive((i) => (i + 1) % shown.length), AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [hasMultiple, hovering, lightboxOpen, reducedMotion, shown.length])

  return (
    <div>
      <div
        className="group relative overflow-hidden rounded-2xl ring-1 ring-edge"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <motion.div layout={!reducedMotion}>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label={t('gallery.openFullscreen')}
            className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <motion.img
              key={shown[active]}
              initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reducedMotion ? 0 : DUR_FAST_S }}
              src={adaptiveImageUrl(shown[active])}
              alt={alt}
              className="aspect-[16/10] w-full object-cover"
            />
          </button>
        </motion.div>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label={t('gallery.prev')}
              className="btn-motion absolute top-1/2 left-3 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-page/70 text-ink backdrop-blur-sm ring-1 ring-edge opacity-0 transition-opacity duration-[var(--dur-micro)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ChevronLeftIcon size={18} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={t('gallery.next')}
              className="btn-motion absolute top-1/2 right-3 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-page/70 text-ink backdrop-blur-sm ring-1 ring-edge opacity-0 transition-opacity duration-[var(--dur-micro)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ChevronRightIcon size={18} />
            </button>

            {/* Position dots — also communicate progress while autoplay is running. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
              {shown.map((image, index) => (
                <span
                  key={image}
                  className={[
                    'h-1.5 rounded-full transition-all duration-[var(--dur-micro)]',
                    index === active ? 'w-5 bg-gold-ink' : 'w-1.5 bg-page/70',
                  ].join(' ')}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="mt-3 flex gap-2.5">
          {shown.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => goTo(index)}
              aria-label={t('gallery.photoAlt', { n: index + 1 })}
              aria-current={index === active}
              className={[
                'overflow-hidden rounded-lg ring-1 transition-all focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none',
                index === active ? 'ring-accent' : 'ring-edge hover:ring-gold-line',
              ].join(' ')}
            >
              <img
                src={adaptiveImageUrl(image)}
                alt=""
                loading="lazy"
                className="h-16 w-24 object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <GalleryLightbox
          images={shown}
          alt={alt}
          active={active}
          onChange={goTo}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}

interface GalleryLightboxProps {
  images: readonly string[]
  alt: string
  active: number
  onChange: (index: number) => void
  onClose: () => void
}

/**
 * Full-screen photo viewer, portalled to `document.body`. Deliberately its own component rather
 * than a `shared/ui/Modal` — that primitive is a fixed-width white admin card (see its own doc
 * comment), and a photo viewer needs a full-bleed dark stage instead.
 */
function GalleryLightbox({ images, alt, active, onChange, onClose }: GalleryLightboxProps) {
  const hasMultiple = images.length > 1
  const { t } = useLocale()

  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (hasMultiple && e.key === 'ArrowLeft') onChange(active - 1)
      if (hasMultiple && e.key === 'ArrowRight') onChange(active + 1)
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [active, hasMultiple, onChange, onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/92 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('gallery.close')}
        className="btn-motion absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 ring-1 ring-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <CloseIcon size={18} />
      </button>

      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={images[active]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR_FAST_S }}
          src={adaptiveImageUrl(images[active])}
          alt={alt}
          className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
        />
      </AnimatePresence>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={() => onChange(active - 1)}
            aria-label={t('gallery.prev')}
            className="btn-motion absolute top-1/2 left-3 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/80 ring-1 ring-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:left-6"
          >
            <ChevronLeftIcon size={22} />
          </button>
          <button
            type="button"
            onClick={() => onChange(active + 1)}
            aria-label={t('gallery.next')}
            className="btn-motion absolute top-1/2 right-3 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/80 ring-1 ring-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:right-6"
          >
            <ChevronRightIcon size={22} />
          </button>

          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm text-white/70">
            {t('gallery.counter', { current: active + 1, total: images.length })}
          </span>
        </>
      )}
    </div>,
    document.body,
  )
}
