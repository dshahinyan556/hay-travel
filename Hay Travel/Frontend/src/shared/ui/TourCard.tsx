import { Link } from 'react-router'
import type { Tour } from '@/shared/types/tour'
import { REGION_BY_SLUG } from '@/shared/data/armeniaRegions'
import { formatDuration, formatShortDate } from '@/shared/lib/format'
import { adaptiveImageUrl } from '@/shared/lib/adaptiveImage'
import { useMoney } from '@/shared/currency'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { catalogBasePrice, isPerPersonPricing } from '@/shared/booking'
import { FormatChip, KindChip } from './Chip'
import { ProductTag } from './ProductTag'
import { ArrowRightIcon, CarIcon, ClockIcon, MapPinIcon } from './icons'

/**
 * Tour card for the showcase, catalog and region panel.
 *
 * ── Alignment (explicit client requirement) ───────────────────────────────────────────────
 * In the first version the price "floated": a card with a one-line title pulled its footer up,
 * so prices in a row sat at different heights. Fixed structurally, not with magic numbers:
 *
 *   1. `h-full` + a `flex flex-col` body makes every card fill its grid cell, so all cards in
 *      a row share one height (CSS grid stretches them by default).
 *   2. The footer (duration + price) gets `mt-auto`, pinning it to the bottom — the price line
 *      is therefore at the SAME height on every card regardless of title length.
 *   3. Titles and descriptions are clamped (`line-clamp-2`), so long copy ends in an ellipsis
 *      instead of pushing the layout around.
 *
 * A fixed title height would have been the other option, but it wastes vertical space on short
 * titles and still breaks at narrow widths — clamping plus `mt-auto` holds at any breakpoint.
 *
 * ── Interaction ───────────────────────────────────────────────────────────────────────────
 * The whole card is one link, so there is a single tab stop per card. It used to also reveal a
 * route-summary teaser on hover, sourced from the first day's stops — dropped in stage 5 (by
 * design, not an oversight): the real card endpoint (`GetToursClient`) deliberately does not load
 * the day graph for the whole list (`TourCardModel`'s own doc comment explains why), so there is
 * no itinerary data left to show here. The full itinerary is still one click away, on the detail
 * page.
 *
 * ── Motion (2.4) ──────────────────────────────────────────────────────────────────────────────
 * The card lifts on hover/focus (`.card-lift`, `--dur-fast` / `--ease-back-out`), the top blink
 * stretches, the cover zooms. The lift used to be a framer-motion `whileHover` spring — CSS
 * instead, because a spring is the one thing in the file `prefers-reduced-motion` could not reach,
 * and a hover effect does not justify a JS animation loop per card in a 30-card grid. `.card-lift`
 * also answers `:focus-within`, so tabbing into a card looks the same as hovering it.
 */
export function TourCard({ tour }: { tour: Tour }) {
  const { locale, t } = useLocale()
  // `shared/ui` → `shared/currency` is not a cycle, and threading a pre-formatted price down as a
  // prop from all four render sites would be worse. This card is never rendered under `/admin`.
  const money = useMoney()
  const regions = tour.regionSlugs.map((slug) =>
    locale === 'en' ? REGION_BY_SLUG[slug].en : REGION_BY_SLUG[slug].ru,
  )

  // Server-resolved (Фаза 3/7) — null when there is no discount or it has expired. Nothing here
  // re-derives a percent or checks a date; the backend already did.
  const discountedPrice = tour.discountedPrice
  const discountEndLabel = discountedPrice !== null ? formatShortDate(tour.discountValidUntil ?? '', locale) : ''

  /*
    Чисто групповой продукт продаётся ЗА ЧЕЛОВЕКА, и `priceFrom` (сумма цен дней) для него —
    не та цифра, которую заплатит клиент: решение 0.26 прячет её даже в админке. Поэтому
    карточка такого продукта показывает `groupPricePerPerson` с подписью «за человека».

    `Both` в эту ветку НЕ попадает намеренно: у него обе цены настоящие, и «от» по цене за
    группу остаётся честным — какая из них применится, решает посетитель уже в блоке брони.

    Скидка при этом остаётся серверной (`discountedPrice` — от `TotalPrice`), поэтому в
    групповой ветке зачёркнутой цены не рисуем: смешивать скидку с одного тарифа и цену с
    другого нельзя. Отдельного «дисконтированного за человека» бэк на карточке не отдаёт.
  */
  const perPersonPrice = isPerPersonPricing(tour) ? catalogBasePrice(tour) : null

  /*
    Трансфер в «Избранном» (решение 0.4 / пункт 6.8). Карточка та же самая — иначе ряд на
    главной развалился бы на два разных ритма, — но три вещи у него другие по сути домена:
      * адрес: у трансфера своя детальная `/transfers/:id`, а `GetTourInfo` отвечает на него
        404, так что ссылка на `/tours/:id` вела бы в «страница не найдена»;
      * верхняя строка: регионов у трансфера нет, вместо них маршрут «откуда → куда»;
      * нижняя левая ячейка: длительности нет, вместо неё подпись «цена за авто» — у тура цена
        читается как «за человека», и молчаливо оставить эту привычку на трансфере значит
        готовить спор при оплате.
    Скидок и тегов у трансфера не бывает (решение 0.4), поэтому те ветки просто не срабатывают.
  */
  const isTransfer = tour.kind === 'transfer'
  const route = tour.transferRoute ?? []

  return (
    // `min-w-0`: every caller wraps this in a `grid` item (`<div>`/`<li className="reveal-item
    // grid">`) to keep `.reveal-item`'s and `.card-lift`'s own `transform` off the same element —
    // that makes THIS article a nested grid item too, and a grid item defaults to `min-width:
    // auto` same as a flex item. Confirmed overflowing `TransferCard` (identical wrapper
    // convention) on a phone before this was added there (David, 2026-08-31); applied here too
    // since every grid of these cards shares the same structure.
    <article className="card-lift group h-full min-w-0">
      <Link
        to={isTransfer ? `/transfers/${tour.id}` : `/tours/${tour.id}`}
        className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-panel-raised to-panel ring-1 ring-edge transition-shadow duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] hover:ring-gold-line focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
      >
        {/*
          Top blink (2.3): a short hairline at rest, stretching to the card's full width on
          hover/focus. `scale-x` from a centred origin rather than animating `width`, so the
          browser only ever transforms a compositor layer — `duration-[var(--dur-fast)]` ties it
          to the token that collapses to 1ms under `prefers-reduced-motion` (see `index.css`).
        */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-10 h-px origin-center scale-x-[0.14] bg-gold-line transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] group-hover:scale-x-100 group-focus-within:scale-x-100"
        />

        {/* Cover */}
        <div className="relative aspect-[4/3] shrink-0 overflow-hidden">
          <img
            src={adaptiveImageUrl(tour.coverImage)}
            alt={tour.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[var(--dur-reveal)] ease-[var(--ease-out-soft)] group-hover:scale-105"
          />
          {/* Scrim keeps chip text legible over any photo. */}
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-obsidian/10 to-obsidian/40" />

          {/* Merch tags (up to 3) share the left edge with `KindChip` below — top vs. bottom
              keeps the right side of the photo untouched at any count. */}
          {tour.tags.length > 0 && (
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
              {tour.tags.map((tag) => (
                <ProductTag key={tag.id} color={tag.color}>
                  {tag.label}
                </ProductTag>
              ))}
            </div>
          )}

          {/* Формат встаёт в ОДИН ряд с типом продукта, а не отдельным углом: оба отвечают на
              вопрос «что это за поездка», и разносить их по разным краям фотографии значило бы
              заставить взгляд собирать ответ из двух мест. `flex-wrap` — ради 375px, где
              «Индивидуальный / групповой» рядом с «Экскурсией» в строку не помещается. */}
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-1.5">
            <KindChip kind={tour.kind} />
            <FormatChip format={tour.format} />
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-4">
          {isTransfer ? (
            route.length > 0 && (
              <p className="flex min-w-0 items-center gap-1.5 text-[11px] tracking-[0.14em] text-gold-ink uppercase">
                <span className="truncate">{route[0]}</span>
                {route.length > 1 && (
                  <>
                    <ArrowRightIcon size={13} className="shrink-0" />
                    <span className="truncate">{route[route.length - 1]}</span>
                  </>
                )}
              </p>
            )
          ) : (
            <p className="flex items-center gap-1.5 text-[11px] tracking-[0.14em] text-gold-ink uppercase">
              <MapPinIcon size={13} />
              <span className="truncate">{regions.join(' · ')}</span>
            </p>
          )}

          <h3 className="card-title mt-2 line-clamp-2 text-ink">{tour.title}</h3>

          <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{tour.shortDescription}</p>

          {/* `mt-auto` is what puts every card's price on the same line. */}
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-edge pt-3.5">
            <span className="flex items-center gap-1.5 text-xs text-ink-dim">
              {isTransfer ? (
                <>
                  <CarIcon size={14} />
                  {t('transfers.pricePerCar')}
                </>
              ) : (
                <>
                  <ClockIcon size={14} />
                  {formatDuration(tour.durationDays, tour.durationNights, locale)}
                </>
              )}
            </span>
            {/* Обе ветки держат одну и ту же трёхстрочную сетку (подпись → сумма → сноска),
                поэтому цена в ряду карточек остаётся на одном уровне независимо от формата. */}
            <span className="text-right leading-tight">
              {perPersonPrice !== null ? (
                <>
                  <span className="block text-[10px] tracking-wide text-ink-muted">
                    {t('tourCard.pricePerPerson')}
                  </span>
                  <span className="font-display text-2xl text-gold-ink">{money.format(perPersonPrice)}</span>
                </>
              ) : (
                <>
                  {discountedPrice !== null ? (
                    // Active discount: the original price moves into the label's slot and gets
                    // struck through — same footprint as the non-discounted label line above.
                    <span className="block text-xs text-ink-muted line-through">
                      {money.format(tour.priceFrom)}
                    </span>
                  ) : (
                    // "цена от"/"from" — true in two senses: the smallest group tier, and per
                    // person. `tour.priceFrom` is the base (1–4 guests) price.
                    <span className="block text-[10px] tracking-wide text-ink-muted">
                      {t('tourCard.priceFrom')}
                    </span>
                  )}
                  <span className="font-display text-2xl text-gold-ink">
                    {money.format(discountedPrice ?? tour.priceFrom)}
                  </span>
                  {discountedPrice !== null && discountEndLabel && (
                    <span className="block text-[10px] text-ink-dim">
                      {t('tourCard.discountUntil', { date: discountEndLabel })}
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}

/**
 * Loading placeholder for a `TourCard` grid (2.3). Mirrors the real card's structure exactly —
 * same cover aspect ratio, same body padding, same footer split — so a grid of these never jumps
 * when the real cards land. Shimmer comes from `.skeleton-shimmer` (`--gold-soft`, ~1.8s, see
 * `index.css`), which already disables itself under `prefers-reduced-motion`.
 *
 * `aria-hidden`: this stands in for content, not content itself — screen readers should skip it
 * rather than read out a row of empty bars. Whatever announces the loading state (e.g. an
 * `aria-live` region on the grid) does that job instead.
 */
export function TourCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-panel-raised to-panel ring-1 ring-edge"
    >
      <div className="skeleton-shimmer aspect-[4/3] shrink-0 bg-edge/30" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="skeleton-shimmer h-3 w-2/5 rounded-full bg-edge/30" />
        <div className="skeleton-shimmer h-5 w-4/5 rounded-full bg-edge/30" />
        <div className="skeleton-shimmer h-3 w-full rounded-full bg-edge/30" />
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-edge pt-3.5">
          <div className="skeleton-shimmer h-3 w-14 rounded-full bg-edge/30" />
          <div className="skeleton-shimmer h-6 w-20 rounded-full bg-edge/30" />
        </div>
      </div>
    </div>
  )
}
