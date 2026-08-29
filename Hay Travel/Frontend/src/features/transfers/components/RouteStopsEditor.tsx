import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useIsCompactViewport } from '@/shared/hooks'
import { DragHandle, SortableList } from '@/shared/ui'
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, PlusIcon } from '@/shared/ui/icons'
import { RoutePointField } from './RoutePointField'
import { createRouteStop, type RouteStop } from '../lib/routeStops'

/**
 * Промежуточные остановки маршрута: добавить / удалить / переставить.
 *
 * ── Перетаскивание — существующее ────────────────────────────────────────────────────────────
 * `SortableList` + `DragHandle` (dnd-kit) как есть: механика уже умеет мышь, палец и клавиатуру и
 * сама объявляет перестановки в `aria-live`. Своё перетаскивание здесь было бы третьей копией
 * того, что уже дважды работает в админке. Единственное, чего этим контролам не хватало, —
 * публичной палитры, и она добавлена ИМ (`surface="public"`), а не скопирована сюда.
 *
 * ── Стрелки ↑↓ — только на телефоне ──────────────────────────────────────────────────────────
 * На 375px палец одновременно и тащит строку, и прокручивает страницу — это самое рискованное
 * место всего раздела. Поэтому к ручке добавляется вторая дорога к тому же результату: кнопки
 * «выше»/«ниже». На десктопе их нет — мышью тащить надёжно, и лишние кнопки замусорили бы строку.
 *
 * Крайняя стрелка не исчезает, а гаснет (`disabled`): исчезающая кнопка сдвигала бы соседние
 * прямо под пальцем.
 *
 * ── Строка в две линии на телефоне ───────────────────────────────────────────────────────────
 * Сверху ручка, подпись «Остановка N» и кнопки ↑ ↓ ×; снизу поле адреса во всю ширину. В одну
 * линию всё это не помещается: поле сжалось бы до ~120px, а кнопки — до 24px. На десктопе строка
 * остаётся одной линией.
 *
 * ── Значение — свободный текст ───────────────────────────────────────────────────────────────
 * Каталог `Place` только ПОДСКАЗЫВАЕТ (решение 0.8): отправить заявку с адресом, которого в
 * каталоге нет, можно и нужно.
 */
export interface RouteStopsEditorProps {
  stops: readonly RouteStop[]
  onChange: (stops: RouteStop[]) => void
  suggestions: readonly string[]
  /** Максимум остановок (`MAX_STOPS`): больше — это уже не трансфер, а тур. */
  max: number
  disabled?: boolean
  /** Показывать ли ошибку «заполните остановку» у пустых строк. */
  showErrors: boolean
}

export function RouteStopsEditor({
  stops,
  onChange,
  suggestions,
  max,
  disabled = false,
  showErrors,
}: RouteStopsEditorProps) {
  const { t } = useLocale()
  const isCompact = useIsCompactViewport()

  const editable = [...stops]

  const setAt = (index: number, value: string) => {
    onChange(stops.map((stop, i) => (i === index ? { ...stop, text: value } : stop)))
  }

  const removeAt = (index: number) => {
    onChange(stops.filter((_, i) => i !== index))
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= stops.length) return
    const next = [...stops]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const suggestionList = [...suggestions]

  return (
    <div>
      <span className="block text-[11.5px] text-ink-muted">{t('transfers.request.stopsLabel')}</span>

      {stops.length > 0 && (
        <div className="mt-1.5 space-y-2.5">
          <SortableList
            items={editable}
            getId={(stop) => stop.id}
            onReorder={move}
            itemLabel={t('transfers.request.stopItemLabel')}
          >
            {(stop, index, sortable) => (
              <div
                ref={sortable.setNodeRef}
                style={sortable.style}
                className={[
                  isCompact ? 'rounded-xl border bg-panel p-2.5' : 'flex items-center gap-2.5',
                  isCompact ? (sortable.isDragging ? 'border-gold-line shadow-lg' : 'border-edge') : '',
                ].join(' ')}
              >
                {isCompact ? (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <DragHandle
                        ref={sortable.setActivatorNodeRef}
                        {...sortable.attributes}
                        {...sortable.listeners}
                        surface="public"
                        size="md"
                        label={t('transfers.request.stopDrag')}
                      />
                      <span className="flex-1 truncate text-[10.5px] tracking-[0.14em] text-ink-muted uppercase">
                        {t('transfers.request.stopNumber', { n: index + 1 })}
                      </span>
                      <StopIconButton
                        label={t('transfers.request.stopUp')}
                        disabled={disabled || index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUpIcon size={15} />
                      </StopIconButton>
                      <StopIconButton
                        label={t('transfers.request.stopDown')}
                        disabled={disabled || index === stops.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDownIcon size={15} />
                      </StopIconButton>
                      <StopIconButton
                        label={t('transfers.request.stopRemove')}
                        disabled={disabled}
                        onClick={() => removeAt(index)}
                      >
                        <CloseIcon size={15} />
                      </StopIconButton>
                    </div>
                    <RoutePointField
                      value={stop.text}
                      onChange={(value) => setAt(index, value)}
                      suggestions={suggestionList}
                      disabled={disabled}
                      error={showErrors && stop.text.trim() === ''}
                      placeholder={t('transfers.request.stopPlaceholder')}
                      noResultsText={t('transfers.request.suggestionsEmpty')}
                      aria-label={t('transfers.request.stopNumber', { n: index + 1 })}
                    />
                  </>
                ) : (
                  <>
                    <DragHandle
                      ref={sortable.setActivatorNodeRef}
                      {...sortable.attributes}
                      {...sortable.listeners}
                      surface="public"
                      size="md"
                      label={t('transfers.request.stopDrag')}
                    />
                    <div className="min-w-0 flex-1">
                      <RoutePointField
                        value={stop.text}
                        onChange={(value) => setAt(index, value)}
                        suggestions={suggestionList}
                        disabled={disabled}
                        error={showErrors && stop.text.trim() === ''}
                        placeholder={t('transfers.request.stopPlaceholder')}
                        noResultsText={t('transfers.request.suggestionsEmpty')}
                        aria-label={t('transfers.request.stopNumber', { n: index + 1 })}
                      />
                    </div>
                    <StopIconButton
                      label={t('transfers.request.stopRemove')}
                      disabled={disabled}
                      onClick={() => removeAt(index)}
                    >
                      <CloseIcon size={15} />
                    </StopIconButton>
                  </>
                )}
              </div>
            )}
          </SortableList>
        </div>
      )}

      {stops.length < max ? (
        <button
          type="button"
          onClick={() => onChange([...stops, createRouteStop()])}
          disabled={disabled}
          className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <PlusIcon size={16} />
          {t('transfers.request.stopAdd')}
        </button>
      ) : (
        /* Предел назван словами, а не молчаливо исчезнувшей кнопкой: пропавшая кнопка выглядит
           как поломка, а причина остаётся неизвестной. */
        <p className="mt-2.5 text-[12.5px] leading-snug text-ink-muted">
          {t('transfers.request.stopLimit', { count: max })}
        </p>
      )}
    </div>
  )
}

/** Кнопка ряда остановки: видимые 36px, зона касания 44px за счёт невидимого расширителя —
 * тот же приём, что у кнопок шапки и счётчика корзины. */
function StopIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge text-ink-muted transition-colors before:absolute before:-inset-1 before:content-[''] hover:border-gold-line hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  )
}
