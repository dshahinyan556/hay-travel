import { motion } from 'framer-motion'
import { useReducedMotion } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { ClockIcon, MailIcon, StarIcon } from '@/shared/ui/icons'
import { useAuthImage } from '../hooks/useAuthImage'

/**
 * Left column of the split sign-in screen (Spec 005) — the photograph, its scrim, and the three
 * trust lines over it.
 *
 * No props on purpose: it fetches its own image (`useAuthImage`) and takes its copy from the
 * dictionary, so `AuthSplitLayout` stays a pure frame and does not have to thread a URL through.
 *
 * Below `lg` this is a 190px band across the top instead of a column. The subtitle and the trust
 * list are hidden there rather than shrunk: on a 190px strip they would be an unreadable pile on
 * top of a photo, which is worse than not showing them.
 */
export function AuthPhotoPanel() {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const imageUrl = useAuthImage()

  return (
    // `bg-obsidian` on the root, not on a child: it is what the visitor sees while the setting is
    // still in flight, so the column reads as "dark photo not loaded yet" rather than as a hole.
    <div className="relative isolate flex h-[190px] items-end overflow-hidden bg-obsidian sm:h-[230px] lg:h-auto lg:min-h-[560px]">
      {imageUrl !== '' && (
        // Same slow zoom as the home hero (`HeroSection`), gated the same way — the `.ken-burns`
        // class lets index.css shut it off in CSS, the JS gate means it never starts at all.
        <motion.img
          src={imageUrl}
          alt=""
          initial={{ scale: 1.08 }}
          animate={{ scale: reducedMotion ? 1.08 : 1 }}
          transition={{ duration: reducedMotion ? 0 : 12, ease: 'linear' }}
          className="ken-burns absolute inset-0 -z-10 h-full w-full object-cover"
        />
      )}
      {/*
        The hero's scrim tokens, but WITHOUT its `--hero-fade` layer: that layer exists to ease a
        dark hero into a light page below it. Here the column's neighbour is the form panel, side
        by side from `lg` — there is nothing to fade into.
      */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(to top, var(--hero-scrim-from) 0%, var(--hero-scrim-via) 50%, var(--hero-scrim-to) 100%)',
        }}
      />

      <div className="p-6 lg:p-9">
        {/*
          Fixed gold, NOT the theme-flipping `--gold-ink`: this sits on a guaranteed-dark backdrop
          in both skins, exactly like the hero's own eyebrow, and in the light theme `--gold-ink`
          is bronze (#6b4a15) — unreadable on a dark photo.

          Why an inline style and not `text-gold`: `.section-eyebrow` is an UNLAYERED rule in
          index.css and `@apply`s its own `text-gold-ink`, while `text-gold` compiles into
          `@layer utilities`. Unlayered author CSS outranks every layer regardless of specificity,
          so the utility would lose silently — and only in the light theme. This is the same
          layering caveat index.css documents for `.reveal-item`/`.card-lift`; there the fix is to
          wrap, here there is nothing to wrap, so the colour is set at the one priority the
          unlayered rule cannot beat. Do not "simplify" this back into a class.
        */}
        <p className="section-eyebrow" style={{ color: 'var(--color-gold)' }}>
          {t('auth.photo.eyebrow')}
        </p>
        <h2 className="font-display mt-3 max-w-[14ch] text-[26px] leading-tight text-hero-ink lg:text-[38px]">
          <span className="lg:hidden">{t('auth.photo.titleShort')}</span>
          <span className="hidden lg:inline">{t('auth.photo.title')}</span>
        </h2>
        <p className="mt-2.5 hidden max-w-[34ch] text-sm text-hero-ink-dim lg:block">
          {t('auth.photo.subtitle')}
        </p>
        <ul className="mt-4 hidden gap-2.5 lg:grid">
          <li className="flex items-center gap-2.5 text-[13px] text-hero-ink-dim">
            <StarIcon size={17} className="shrink-0 text-gold" />
            {t('auth.photo.trust1')}
          </li>
          <li className="flex items-center gap-2.5 text-[13px] text-hero-ink-dim">
            <MailIcon size={17} className="shrink-0 text-gold" />
            {t('auth.photo.trust2')}
          </li>
          <li className="flex items-center gap-2.5 text-[13px] text-hero-ink-dim">
            <ClockIcon size={17} className="shrink-0 text-gold" />
            {t('auth.photo.trust3')}
          </li>
        </ul>
      </div>
    </div>
  )
}
