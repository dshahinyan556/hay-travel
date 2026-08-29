/**
 * `KindChip` — small labelled pill answering "is this a tour or a one-day excursion?", a domain
 * fact always shown on tour cards and detail pages.
 *
 * Colour encodes the kind consistently across the whole site: wine + moon = tour (has an
 * overnight stay), gold + sun = excursion (single day). See `docs/client-site.md`.
 *
 * Третий вид — ТРАНСФЕР (батч 2026-08-29): золотая обводка на прозрачном + иконка машины.
 * Не третий заливной цвет: у трансфера нет ночёвок и дней, он не «ещё одна поездка», а услуга
 * перевозки, и приглушённый бейдж это ровно и говорит. Появляется только в «Избранном» на
 * главной и на карточках `/transfers` — в общий каталог трансферы не попадают (решение 0.15).
 *
 * `FormatChip` (батч 2026-08-29) отвечает на второй вопрос — «еду один/своей компанией или в
 * сборной группе?» — и живёт в этом же файле намеренно: два бейджа стоят бок о бок на карточке
 * и в шапке детальной, и любой их визуальный разъезд был бы заметен сразу.
 */

import type { TourKind } from '@/shared/types/tour'
import { TourFormat } from '@/shared/types/tourFormat'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TranslationKey } from '@/shared/i18n/dictionary'
import { CarIcon, GuideIcon, MoonIcon, SunIcon, UsersIcon } from './icons'

const KIND_GLYPH = { tour: MoonIcon, excursion: SunIcon, transfer: CarIcon } as const

const KIND_LABEL_KEY: Record<TourKind, TranslationKey> = {
  tour: 'chip.tour',
  excursion: 'chip.excursion',
  transfer: 'chip.transfer',
}

const KIND_TONE: Record<TourKind, string> = {
  tour: 'bg-wine-tint/90 text-gold-light ring-1 ring-wine/60',
  excursion: 'bg-obsidian/70 text-gold ring-1 ring-gold-deep/50',
  transfer: 'bg-obsidian/60 text-gold-light ring-1 ring-gold-deep/60',
}

export function KindChip({ kind }: { kind: TourKind }) {
  const { t } = useLocale()
  const Glyph = KIND_GLYPH[kind]
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm',
        KIND_TONE[kind],
      ].join(' ')}
    >
      <Glyph size={13} />
      {t(KIND_LABEL_KEY[kind])}
    </span>
  )
}

/** Подпись формата. `Both` — одна строка «Индивидуальный / групповой», а не два бейджа рядом:
 * на карточке слева уже стоят `KindChip` и до трёх мерч-тегов, и второй бейдж формата
 * превратил бы угол фотографии в столбик плашек. */
const FORMAT_LABEL_KEY: Record<TourFormat, TranslationKey> = {
  [TourFormat.Individual]: 'chip.formatIndividual',
  [TourFormat.Group]: 'chip.formatGroup',
  [TourFormat.Both]: 'chip.formatBoth',
}

export interface FormatChipProps {
  /** `null` — продукт создан до батча 2026-08-29 и формата не имеет: бейдж не рисуется вовсе,
   * подписывать такой продукт «индивидуальным» задним числом мы не вправе. */
  format: TourFormat | null
  /**
   * `'photo'` — поверх обложки, рядом с `KindChip`: фиксированные тёмные цвета, потому что под
   * бейджем произвольная фотография, а не тема сайта. `'surface'` — на панели/фоне страницы
   * (шапка детальной, блок брони): ролевые токены, которые следуют за светлой/тёмной темой.
   */
  tone?: 'photo' | 'surface'
}

export function FormatChip({ format, tone = 'photo' }: FormatChipProps) {
  const { t } = useLocale()
  if (format === null) return null

  // Иконка — по «главному» смыслу: у `Both` группа, потому что именно она отличает продукт от
  // всех остальных (индивидуально продаётся всё).
  const Glyph = format === TourFormat.Individual ? GuideIcon : UsersIcon

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        tone === 'photo'
          ? 'bg-obsidian/70 text-cream ring-1 ring-cream/20 backdrop-blur-sm'
          : 'bg-panel-raised text-ink-dim ring-1 ring-edge',
      ].join(' ')}
    >
      <Glyph size={13} />
      {t(FORMAT_LABEL_KEY[format])}
    </span>
  )
}
