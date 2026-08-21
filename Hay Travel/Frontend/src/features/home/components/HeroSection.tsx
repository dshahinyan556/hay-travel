import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { HeroContent } from '@/shared/api/siteSettings'
import { adaptiveImageUrl } from '@/shared/lib/adaptiveImage'
import { ArrowRightIcon, MapIcon } from '@/shared/ui/icons'

interface HeroSectionProps {
  /**
   * `hero.imageUrl`/`title`/`subtitle`/`ctaLabel`/`ctaHref` from the admin "Настройки" screen
   * (stage 5.2) — the only five hero fields the catalog exposes (`SiteSettingCatalog.cs`). The
   * secondary "Карта регионов" button below is NOT among them and stays hardcoded, same as
   * before.
   */
  hero: HeroContent
}

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
 *
 * ── Motion (2.4) ──────────────────────────────────────────────────────────────────────────────
 * Everything that travels in this section is gated on the same `reducedMotion` flag: the slow zoom
 * (gated twice on purpose — the `.ken-burns` class lets `index.css` shut it off in CSS with an
 * `!important` transform that beats framer's inline one, and the JS gate below means the animation
 * is never even started) AND the four staggered copy blocks below it. The copy still fades in under
 * reduced motion (`opacity` is untouched) — only the `y` travel and the transition duration collapse
 * to 0, so the block appears in place instead of rising into it. The rest of the section is
 * untouched: this is the reference hero, not a component to redesign.
 */
export function HeroSection({ hero }: HeroSectionProps) {
  const reducedMotion = useReducedMotion()
  const { t } = useLocale()

  return (
    <section className="hero relative isolate flex min-h-[78vh] items-end overflow-hidden">
      <motion.img
        src={adaptiveImageUrl(hero.imageUrl)}
        alt=""
        initial={{ scale: 1.08 }}
        animate={{ scale: reducedMotion ? 1.08 : 1 }}
        transition={{ duration: reducedMotion ? 0 : 12, ease: 'linear' }}
        className="ken-burns absolute inset-0 -z-10 h-full w-full object-cover"
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
        <motion.h1
          initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.7 }}
          // One gold block for the whole heading, not a "last word" split: that treatment assumed
          // one fixed Russian phrase, which stopped being true the moment the copy became
          // admin-editable free text (`hero.title` can be any length, any wording).
          // 44/56/68 rather than the old 48/60/72: Prata sets denser, and at 72px a two-line
          // heading starts to topple. The 1.1 leading (was 1.05) is mandatory, not taste — see
          // `.h1-page` in index.css: `.text-gold-sheen` clips its gradient to the line box.
          className="text-gold-sheen mt-4 max-w-3xl font-display text-[44px] leading-[1.1] sm:text-[56px] lg:text-[68px]"
        >
          {hero.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.7, delay: 0.2 }}
          className="mt-5 max-w-xl text-base text-hero-ink-dim sm:text-lg"
        >
          {hero.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.7, delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          {/*
            `.btn-motion` replaces `transition-colors` rather than joining it (2.4): it declares the
            colour half itself, and being unlayered it would outrank the utility anyway. Resting
            appearance is unchanged — it only adds the 1px hover lift and the 90ms press.

            A plain `<a>`, not `Link`: `hero.ctaHref` is admin-entered free text (`SiteSettingCatalog`
            types it as a URL, not a route), so it may not be an internal path at all — `Link`
            would try to client-side-route it either way.
          */}
          <a
            href={hero.ctaHref}
            className="btn-motion btn-sheen inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-obsidian hover:bg-gold-light focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:outline-none"
          >
            {hero.ctaLabel}
            <ArrowRightIcon size={16} />
          </a>
          <Link
            to="/regions"
            className="btn-motion btn-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm text-gold-light ring-1 ring-gold-deep/60 hover:bg-gold-light/10 hover:ring-gold-light focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:outline-none"
          >
            <MapIcon size={16} />
            {t('home.hero.regionsCta')}
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
