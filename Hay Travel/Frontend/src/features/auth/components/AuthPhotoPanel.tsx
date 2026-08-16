import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useReducedMotion } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { adaptiveImageUrl } from '@/shared/lib/adaptiveImage'
import { ClockIcon, MailIcon, StarIcon } from '@/shared/ui/icons'
import { Reveal } from '@/shared/ui'
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
 *
 * ── Motion (2026-08-13, more life than the home hero on purpose) ────────────────────────────────
 * The hero's Ken Burns finishes and holds — fine for a section people glance past. This is the
 * first thing a returning visitor stares at for a minute while they type a password, so it never
 * settles: `scale`/`x`/`y` loop on a mirrored 16s cycle (never a hard reset), a separate 9s glow
 * drifts warm light across the frame in `--color-gold` (independent cycle length so the two never
 * fall into lockstep), and the photo itself runs a touch more saturated/contrasty than the source.
 * A mouse-move parallax nudges the photo and the glow at different depths (desktop pointer only,
 * `event.pointerType === 'mouse'` gate — touch "hover" would otherwise fire on tap-and-hold).
 * Everything is gated on `reducedMotion` in JS AND carries `.ken-burns`/`.parallax`, which
 * `index.css` force-disables under `prefers-reduced-motion` — same double-gate as `HeroSection`.
 */
export function AuthPhotoPanel() {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const imageUrl = useAuthImage()

  // Raw pointer offset in [-1, 1] per axis, spring-smoothed so motion trails the cursor instead
  // of snapping to it. Left at (0, 0) — centred — whenever the pointer isn't a mouse over the panel.
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const springX = useSpring(pointerX, { stiffness: 60, damping: 20, mass: 0.6 })
  const springY = useSpring(pointerY, { stiffness: 60, damping: 20, mass: 0.6 })
  // Photo (background layer) drifts a little; the glow (foreground light) drifts more — that
  // depth difference is what reads as parallax rather than "the whole image jiggles".
  const photoX = useTransform(springX, (value) => `${value * -8}px`)
  const photoY = useTransform(springY, (value) => `${value * -6}px`)
  const glowX = useTransform(springX, (value) => `calc(-50% + ${value * 14}%)`)
  const glowY = useTransform(springY, (value) => `calc(-50% + ${value * 12}%)`)

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reducedMotion || event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    pointerX.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1)
    pointerY.set(((event.clientY - bounds.top) / bounds.height) * 2 - 1)
  }

  function handlePointerLeave() {
    pointerX.set(0)
    pointerY.set(0)
  }

  return (
    // `bg-obsidian` on the root, not on a child: it is what the visitor sees while the setting is
    // still in flight, so the column reads as "dark photo not loaded yet" rather than as a hole.
    <div
      className="relative isolate flex h-[190px] items-end overflow-hidden bg-obsidian sm:h-[230px] lg:h-auto lg:min-h-[560px]"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {imageUrl !== '' && (
        <motion.img
          src={adaptiveImageUrl(imageUrl)}
          alt=""
          style={{
            x: reducedMotion ? 0 : photoX,
            y: reducedMotion ? 0 : photoY,
            filter: 'saturate(1.18) contrast(1.06)',
          }}
          initial={{ scale: 1.08 }}
          animate={
            reducedMotion
              ? { scale: 1.08 }
              : { scale: [1.06, 1.16, 1.06], x: ['-1%', '1.4%', '-1%'], y: ['0.8%', '-1%', '0.8%'] }
          }
          transition={
            reducedMotion ? { duration: 0 } : { duration: 16, ease: [0.37, 0, 0.63, 1], repeat: Infinity }
          }
          className="ken-burns parallax absolute inset-0 -z-10 h-full w-full object-cover"
        />
      )}
      {/* The "juice": a soft warm glow drifting over the photo, `soft-light`-blended so it reads
          as light on the scene rather than a flat colour wash. Sits between the photo and the
          scrim in DOM order — it must blend with the photo below it, not get blended itself. */}
      <motion.div
        aria-hidden
        style={{
          left: '50%',
          top: '40%',
          x: reducedMotion ? 'calc(-50% + 0%)' : glowX,
          y: reducedMotion ? 'calc(-50% + 0%)' : glowY,
          backgroundImage:
            'radial-gradient(closest-side, color-mix(in srgb, var(--color-gold) 55%, transparent), transparent 70%)',
          mixBlendMode: 'soft-light',
        }}
        animate={reducedMotion ? { opacity: 0.5 } : { opacity: [0.35, 0.7, 0.35] }}
        transition={reducedMotion ? { duration: 0 } : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        className="parallax pointer-events-none absolute -z-10 h-[70%] w-[70%]"
      />
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
        <Reveal as="ul" group rise={10} className="mt-4 hidden gap-2.5 lg:grid">
          <li className="reveal-item flex items-center gap-2.5 text-[13px] text-hero-ink-dim">
            <StarIcon size={17} className="shrink-0 text-gold" />
            {t('auth.photo.trust1')}
          </li>
          <li className="reveal-item flex items-center gap-2.5 text-[13px] text-hero-ink-dim">
            <MailIcon size={17} className="shrink-0 text-gold" />
            {t('auth.photo.trust2')}
          </li>
          <li className="reveal-item flex items-center gap-2.5 text-[13px] text-hero-ink-dim">
            <ClockIcon size={17} className="shrink-0 text-gold" />
            {t('auth.photo.trust3')}
          </li>
        </Reveal>
      </div>
    </div>
  )
}
