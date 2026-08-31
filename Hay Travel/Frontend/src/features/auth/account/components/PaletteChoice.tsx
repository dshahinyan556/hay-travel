import { useLocale } from '@/shared/i18n/LocaleProvider'
import { PALETTE_IDS, type PaletteId } from '@/shared/lib/palette'
import type { Theme } from '@/shared/lib/theme'
import { PALETTE_LABEL_KEY, paletteSwatch } from '../lib/paletteSwatch'

/**
 * Выбор палитры — единственная настройка раздела, у которой ЕСТЬ третье состояние: «личного выбора
 * нет, следуй сайту» (`preferredPalette: null`).
 *
 * ── Как это состояние выражено на экране ──────────────────────────────────────────────────────
 * Отдельной кнопки «как на сайте» нет: она была бы четвёртой сущностью рядом с двумя пресетами и
 * потребовала бы объяснять, чем «как на сайте» отличается от «обсидиан», когда на сайте обсидиан.
 * Вместо этого пресет, совпадающий с текущим дефолтом сайта, помечен «по умолчанию», и выбор
 * ИМЕННО ЕГО означает `null` — «следовать сайту». Любой другой пресет закрепляется явно.
 *
 * Цена решения одна: закрепить дефолтный пресет «навсегда, даже если админ сменит дефолт»
 * невозможно. Сценария такого никто не заказывал, а обратный — «человек ничего не выбирал и обязан
 * следовать за админом» — прямо описан в контракте `api/Account/Preferences` и важнее.
 */
export interface PaletteChoiceProps {
  /** Личный выбор. `null` — выбора нет, активным подсвечен пресет сайта. */
  value: PaletteId | null
  /** Текущий `theme.activePalette` сайта — тот, что получает пометку «по умолчанию». */
  sitePalette: PaletteId
  /** `null` — «следуй сайту». */
  onChange: (value: PaletteId | null) => void
  /** Тема, в которой рисовать образцы: пятно обязано показывать пресет так, как человек его
   *  увидит, а не всегда в тёмном. */
  theme: Theme
}

export function PaletteChoice({ value, sitePalette, onChange, theme }: PaletteChoiceProps) {
  const { t } = useLocale()
  const active = value ?? sitePalette

  return (
    // На телефоне карточки идут в столбик во всю ширину (§10 мокапа): в ряд по две они дают
    // 160-пиксельные плитки, в которых название пресета переносится на три строки.
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
      {PALETTE_IDS.map((id) => {
        const isActive = id === active
        const isSiteDefault = id === sitePalette
        const swatch = paletteSwatch(id, theme)

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(isSiteDefault ? null : id)}
            aria-pressed={isActive}
            className={[
              'flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)]',
              'focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none',
              isActive
                ? 'bg-gold-soft ring-2 ring-gold-line ring-inset'
                : 'ring-1 ring-edge-strong ring-inset hover:bg-gold-soft/40',
            ].join(' ')}
          >
            {/* Пятно из двух цветов пресета — фон страницы и акцент. Диагональ, а не два кружка:
                одно пятно занимает меньше места в строке и читается как «образец», а не как две
                независимые метки. Собственное тонкое кольцо нужно, чтобы тёмный образец не
                растворялся в тёмной карточке. */}
            <span
              aria-hidden
              className="size-7 shrink-0 rounded-full ring-1 ring-edge-strong ring-inset"
              style={{
                background: `linear-gradient(135deg, ${swatch.surface} 58%, ${swatch.accent} 58%)`,
              }}
            />

            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-ink">
                {t(PALETTE_LABEL_KEY[id])}
                {isSiteDefault && (
                  <span className="inline-flex items-center rounded-full bg-gold-soft px-2 py-px text-[10.5px] font-bold tracking-[.1em] whitespace-nowrap text-gold-ink uppercase ring-1 ring-gold-line">
                    {t('account.pref.paletteDefaultChip')}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-ink-muted">
                {isSiteDefault
                  ? t('account.pref.paletteFollowsSite')
                  : t('account.pref.palettePersonal')}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
