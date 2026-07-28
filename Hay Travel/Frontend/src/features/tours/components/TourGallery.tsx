import { useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Detail-page gallery: one large frame plus thumbnails.
 *
 * A simple index-swap rather than a carousel library — with the handful of photos a tour has,
 * a slider would add a dependency and swipe handling for no gain. `layoutId` on the frame lets
 * framer cross-fade between shots.
 */
export function TourGallery({ images, alt }: { images: readonly string[]; alt: string }) {
  const [active, setActive] = useState(0)
  const shown = images.length > 0 ? images : ['']

  return (
    <div>
      <motion.div layout className="overflow-hidden rounded-2xl ring-1 ring-edge">
        <motion.img
          key={shown[active]}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          src={shown[active]}
          alt={alt}
          className="aspect-[16/10] w-full object-cover"
        />
      </motion.div>

      {shown.length > 1 && (
        <div className="mt-3 flex gap-2.5">
          {shown.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Фото ${index + 1}`}
              aria-current={index === active}
              className={[
                'overflow-hidden rounded-lg ring-1 transition-all focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none',
                index === active ? 'ring-accent' : 'ring-edge hover:ring-gold-line',
              ].join(' ')}
            >
              <img src={image} alt="" className="h-16 w-24 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
