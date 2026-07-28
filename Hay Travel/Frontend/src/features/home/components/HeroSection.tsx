import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowRightIcon, MapIcon, StarIcon } from '@/shared/ui/icons'

/**
 * Generated placeholder, same as the tour covers — swap for real photography later.
 * A remote stock URL is deliberately avoided: the hero is the first thing painted, and a
 * broken or slow image there ruins the first impression.
 */
const HERO_IMAGE = '/placeholders/tatev.svg'

/**
 * Full-bleed cinematic hero.
 *
 * The photo sits in a container with a heavy bottom scrim so display type stays legible over
 * an arbitrary image — the client will swap in their own photography later, and the scrim
 * means a bright shot won't break the headline. Copy is staggered in; the image itself gets a
 * slow scale so the section feels alive without a video payload.
 *
 * The hero stays CINEMATIC (dark photo + dark scrim) in both themes — a parchment mask over the
 * shot would wash it out. So its content deliberately does NOT follow the theme: text uses the
 * fixed `hero-ink` tokens and the accents keep the vivid dark-theme gold literals. The `hero`
 * class is what `index.css` hooks to keep `.text-gold-sheen` bright here in the light theme.
 */
export function HeroSection() {
  return (
    <section className="hero relative isolate flex min-h-[78vh] items-end overflow-hidden">
      <motion.img
        src={HERO_IMAGE}
        alt=""
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 12, ease: 'linear' }}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      {/*
        Two stacked gradients, both theme tokens rather than `from-page/…`: the page colour flips
        to parchment in the light theme, which would have erased the scrim and left the headline
        sitting on bare photo. The first layer (painted on top) eases the bottom edge into the
        page colour so the dark hero doesn't butt against a light page.
      */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(to top, var(--hero-fade) 0%, transparent 12%), ' +
            'linear-gradient(to top, var(--hero-scrim-from) 0%, var(--hero-scrim-via) 50%, var(--hero-scrim-to) 100%)',
        }}
      />

      <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-gold uppercase"
        >
          <StarIcon size={14} />
          Сезон 2026 открыт
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] text-hero-ink sm:text-6xl lg:text-7xl"
        >
          Армения за пределами
          <span className="text-gold-sheen block">путеводителей</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-5 max-w-xl text-base text-hero-ink-dim sm:text-lg"
        >
          Монастыри в ущельях, чёрный туф Гюмри, вино Арени и Севан на рассвете. Небольшие группы
          и местные гиды — от однодневных экскурсий до маршрутов на весь юг.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <Link
            to="/trips"
            className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:outline-none"
          >
            Смотреть путешествия
            <ArrowRightIcon size={16} />
          </Link>
          <Link
            to="/regions"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm text-gold-light ring-1 ring-gold-deep/60 transition-colors hover:bg-wine-tint focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:outline-none"
          >
            <MapIcon size={16} />
            Карта регионов
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
