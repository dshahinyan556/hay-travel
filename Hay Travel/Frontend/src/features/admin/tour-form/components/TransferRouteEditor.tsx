import { SuggestInput } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { Localized } from '@/features/admin/types/form'
import type { TransferRoutePointFormState } from '@/features/admin/types/form'
import type { LangKey } from '@/features/admin/tour-form/reducer/tourFormReducer'
import type { TransferEndpoint } from '@/features/admin/tour-form/reducer/tourFormReducer'
import { adminUiCopy } from '@/features/admin/ui/adminUiCopy'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import { LocalizedListEditor } from './LocalizedListEditor'

export interface TransferRouteEditorProps {
  from: TransferRoutePointFormState
  stops: TransferRoutePointFormState[]
  to: TransferRoutePointFormState
  /** Place-catalog names offered while typing — suggestions only, never a hard link (решение 0.8). */
  suggestions: Localized[]
  fromError?: string
  toError?: string
  /** Per-stop errors keyed by stop `key` (a stop left blank). */
  stopErrors: Record<string, string | undefined>
  onChangeEndpointText: (endpoint: TransferEndpoint, lang: LangKey, value: string) => void
  onAddStop: () => void
  onRemoveStop: (key: string) => void
  onReorderStops: (fromIndex: number, toIndex: number) => void
  onChangeStopText: (key: string, lang: LangKey, value: string) => void
}

/**
 * Маршрут трансфера: ровно одна точка «Откуда», 0..N остановок и ровно одна «Куда» (пункт 3.7).
 *
 * Инвариант «ровно по одной конечной точке» держится ФОРМОЙ СОСТОЯНИЯ, а не проверкой: `from` и
 * `to` — отдельные поля, а не строки списка, поэтому их физически нельзя ни удалить, ни добавить
 * второй раз. Перетаскиванием переставляются только остановки — и через уже существующий
 * `LocalizedListEditor` (внутри `SortableList` + `SuggestInput`), а не через собственный d-n-d.
 *
 * Значения — свободный текст с подсказками из каталога `Place`. Жёсткой привязки к каталогу тут
 * нет (в отличие от точек маршрута дня): у трансфера точка может быть адресом или аэропортом,
 * которых в каталоге мест нет и заводить их туда незачем.
 */
export function TransferRouteEditor({
  from,
  stops,
  to,
  suggestions,
  fromError,
  toError,
  stopErrors,
  onChangeEndpointText,
  onAddStop,
  onRemoveStop,
  onReorderStops,
  onChangeStopText,
}: TransferRouteEditorProps) {
  const copy = useCopy(tourFormCopy).transfer
  // Первая же остановка с ошибкой поднимается в заголовок списка: `LocalizedListEditor` умеет
  // показать одну ошибку на весь список, а не по строкам, и заводить ради этого второй вариант
  // разметки строки не стоит — пустых остановок обычно ровно одна, только что добавленная.
  const firstStopError = stops.map((s) => stopErrors[s.key]).find(Boolean)

  return (
    <HelpRevealZone className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-neutral-800">{copy.routeTitle}</h4>
        <HelpButton surface="admin" title={copy.routeTitle}>
          {copy.routeHelp}
        </HelpButton>
      </div>

      <EndpointField
        label={copy.from}
        value={from.text}
        suggestions={suggestions}
        error={fromError}
        onChange={(lang, value) => onChangeEndpointText('from', lang, value)}
      />

      <LocalizedListEditor
        title={copy.stopsTitle}
        hint={copy.stopsHint}
        emptyText={copy.stopsEmpty}
        addLabel={copy.stopsAdd}
        itemNoun={copy.stopNoun}
        itemLabel={copy.stopLabel}
        error={firstStopError}
        items={stops}
        suggestions={suggestions}
        onAdd={onAddStop}
        onRemove={onRemoveStop}
        onReorder={onReorderStops}
        onChangeText={onChangeStopText}
      />

      <EndpointField
        label={copy.to}
        value={to.text}
        suggestions={suggestions}
        error={toError}
        onChange={(lang, value) => onChangeEndpointText('to', lang, value)}
      />
    </HelpRevealZone>
  )
}

interface EndpointFieldProps {
  label: string
  value: Localized
  suggestions: Localized[]
  error?: string
  onChange: (lang: LangKey, value: string) => void
}

/**
 * Одна конечная точка маршрута: подпись + пара RU|EN с подсказками. Разметка строки намеренно
 * повторяет строку `LocalizedListEditor` (та же сетка `sm:grid-cols-2`, те же плейсхолдеры-языки),
 * чтобы «Откуда», остановки и «Куда» читались как один список, а не как три разных контрола —
 * сам `LocalizedListEditor` тут не подходит: у него есть «добавить»/«удалить», которых у конечной
 * точки быть не должно.
 */
function EndpointField({ label, value, suggestions, error, onChange }: EndpointFieldProps) {
  const translation = useCopy(adminUiCopy).translation
  const ruSuggestions = suggestions.map((s) => s.ru).filter(Boolean)
  const enSuggestions = suggestions.map((s) => s.en).filter(Boolean)
  const pickSuggestion = (label_: string, lang: LangKey) => {
    const match = suggestions.find((s) => s[lang] === label_)
    if (!match) return
    onChange('ru', match.ru)
    onChange('en', match.en)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-neutral-800">
        {label}
        <span aria-hidden="true" className="ml-0.5 text-rose-700">
          *
        </span>
      </span>
      <div className="grid gap-2 sm:grid-cols-2">
        <SuggestInput
          value={value.ru}
          onChange={(next) => onChange('ru', next)}
          onPick={(picked) => pickSuggestion(picked, 'ru')}
          suggestions={ruSuggestions}
          aria-label={translation.fieldInLang(label, translation.langName.ru)}
          placeholder={translation.langName.ru}
          error={Boolean(error)}
          className="text-sm"
        />
        <SuggestInput
          value={value.en}
          onChange={(next) => onChange('en', next)}
          onPick={(picked) => pickSuggestion(picked, 'en')}
          suggestions={enSuggestions}
          aria-label={translation.fieldInLang(label, translation.langName.en)}
          placeholder={translation.langName.en}
          className="text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}
