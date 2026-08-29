import { useMemo } from 'react'
import { Checkbox, Input, Select } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { jobsCopy } from '../lib/jobsCopy'
import {
  HOUR_PRESET_OPTIONS,
  MINUTE_PRESET_OPTIONS,
  capitalizeFirst,
  cronToPreset,
  isPlausibleCronExpression,
  nextOccurrencesUtc,
  presetToCron,
  type CronPreset,
} from '../lib/jobsModel'
import { formatYerevanUpcoming } from '../lib/jobsTime'

export interface JobScheduleCardProps {
  isEnabled: boolean
  onChangeEnabled: (next: boolean) => void
  /** The EFFECTIVE cron to display/edit — already resolved by the caller (`draft.cron ??
   * job.cronExpression`), never the raw `''` "reset" sentinel `adminJobs.ts#setJobCron` expects.
   * This card only ever hands back a plain expression string; turning "equals the default" into
   * the wire's `''` is `JobDetailPage`'s job (one place owns that mapping, not every caller of
   * this card). */
  cron: string
  onChangeCron: (next: string) => void
  /** Drives the preview label — "Ближайшие запуски" vs "Если сохранить — ближайшие запуски"
   * (mockup §05 vs §06). `draft.cron !== undefined` at the call site. */
  scheduleDirty: boolean
  disabled: boolean
}

/** Every "kind" this card's top `Select` offers — a fixed, small catalogue (mockup §06's
 * hand-off: "каждые N минут · каждый час · каждые N часов · раз в сутки · раз в неделю · своё
 * выражение"), independent of `CronPreset`'s own discriminant only in name (kept separate so the
 * `Select`'s `value` is a plain string key, not a serialised object). */
type FrequencyKind = CronPreset['kind']

function defaultPresetFor(kind: FrequencyKind, current: CronPreset, currentCron: string): CronPreset {
  switch (kind) {
    case 'everyNMinutes':
      return { kind, n: current.kind === 'everyNMinutes' ? current.n : 15 }
    case 'hourly':
      return { kind }
    case 'everyNHours':
      return { kind, n: current.kind === 'everyNHours' ? current.n : 2 }
    case 'dailyAt':
      return current.kind === 'dailyAt'
        ? current
        : current.kind === 'weeklyAt'
          ? { kind, hourUtc: current.hourUtc, minuteUtc: current.minuteUtc }
          : { kind, hourUtc: 0, minuteUtc: 0 }
    case 'weeklyAt':
      return current.kind === 'weeklyAt'
        ? current
        : current.kind === 'dailyAt'
          ? { kind, dayOfWeek: 1, hourUtc: current.hourUtc, minuteUtc: current.minuteUtc }
          : { kind, dayOfWeek: 1, hourUtc: 0, minuteUtc: 0 }
    case 'custom':
      // Prefilled with what's currently effective, not blank — least surprising: switching to
      // "своё выражение" shows the cron that was already going to run, ready to tweak.
      return { kind, expression: currentCron }
  }
}

function timeString(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function parseTimeString(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

/**
 * «Расписание и состояние» — checkbox + preset↔cron editor + a 3-occurrence live preview, fully
 * controlled (mockup §05/§06/§11: "значения из черновика страницы, изменения — наверх"). Renders
 * unconditionally (unlike `JobParametersCard`, every job has a schedule).
 */
export function JobScheduleCard({
  isEnabled,
  onChangeEnabled,
  cron,
  onChangeCron,
  scheduleDirty,
  disabled,
}: JobScheduleCardProps) {
  const copy = useCopy(jobsCopy)
  const { locale } = useLocale()

  const preset = useMemo(() => cronToPreset(cron), [cron])

  // The top `Select` picks a CATEGORY ("kind"), not a specific value — its own option labels must
  // therefore never bake in the currently-chosen N (that used to read e.g. `scheduleFrequencyLabel`
  // with the live preset's `n`, which for `everyNMinutes`/`everyNHours` rendered the exact same text
  // as the refinement `Select` right below it, e.g. both showing "Каждые 15 минут" — looking like a
  // duplicated control, David's fix request 2026-08-29). `everyNMinutesGeneric`/`everyNHoursGeneric`
  // spell out the placeholder "N" instead, so the two selects read as "category" + "specific value".
  const kindOptions = (
    [
      { kind: 'everyNMinutes', label: capitalizeFirst(copy.frequency.everyNMinutesGeneric) },
      { kind: 'hourly', label: capitalizeFirst(copy.frequency.hourly) },
      { kind: 'everyNHours', label: capitalizeFirst(copy.frequency.everyNHoursGeneric) },
      { kind: 'dailyAt', label: capitalizeFirst(copy.frequency.dailyAt) },
      { kind: 'weeklyAt', label: capitalizeFirst(copy.frequency.weeklyAt) },
      { kind: 'custom', label: capitalizeFirst(copy.frequency.custom) },
    ] as const
  ).map((option) => ({ value: option.kind, label: option.label }))

  function commit(next: CronPreset) {
    onChangeCron(presetToCron(next))
  }

  const trimmedCustom = preset.kind === 'custom' ? preset.expression.trim() : ''
  const customFieldCount = trimmedCustom === '' ? 0 : trimmedCustom.split(/\s+/).length
  const customValid = preset.kind !== 'custom' || isPlausibleCronExpression(preset.expression)
  const customError =
    preset.kind === 'custom' && !customValid
      ? customFieldCount !== 5 && customFieldCount !== 6
        ? copy.cronFieldCountError(customFieldCount)
        : copy.cronInvalidError
      : null

  const previewDates = useMemo(
    () => (customValid ? nextOccurrencesUtc(cron, 3, new Date()) : null),
    [cron, customValid],
  )

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
      <p className="mb-3.5 text-[11px] font-bold tracking-[.1em] text-neutral-500 uppercase">
        {copy.scheduleCardTitle}
      </p>

      <HelpRevealZone className="flex items-center gap-2">
        <Checkbox
          label={copy.scheduleCheckboxLabel}
          checked={isEnabled}
          disabled={disabled}
          onChange={(e) => onChangeEnabled(e.target.checked)}
        />
        <HelpButton surface="admin" title={copy.scheduleCheckboxLabel}>
          {copy.scheduleCheckboxHint}
        </HelpButton>
      </HelpRevealZone>

      <hr className="my-4 border-neutral-100" />

      <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-700">{copy.frequencyLabel}</label>
            <Select
              surface="admin"
              value={preset.kind}
              disabled={disabled}
              options={kindOptions}
              onChange={(value) => commit(defaultPresetFor(value as FrequencyKind, preset, cron))}
            />
          </div>

          {/* No repeated "Как часто" label on these two — they refine the choice the primary
              Select just made, not a second independent question, so an `aria-label` (screen
              reader only) is enough; visually they read as one continuous decision. */}
          {preset.kind === 'everyNMinutes' && (
            <Select
              surface="admin"
              aria-label={copy.frequencyLabel}
              value={String(preset.n)}
              disabled={disabled}
              options={MINUTE_PRESET_OPTIONS.map((n) => ({ value: String(n), label: capitalizeFirst(copy.frequency.everyNMinutes(n)) }))}
              onChange={(value) => commit({ kind: 'everyNMinutes', n: Number(value) })}
            />
          )}

          {preset.kind === 'everyNHours' && (
            <Select
              surface="admin"
              aria-label={copy.frequencyLabel}
              value={String(preset.n)}
              disabled={disabled}
              options={HOUR_PRESET_OPTIONS.map((n) => ({ value: String(n), label: capitalizeFirst(copy.frequency.everyNHours(n)) }))}
              onChange={(value) => commit({ kind: 'everyNHours', n: Number(value) })}
            />
          )}

          {preset.kind === 'weeklyAt' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-700">{copy.weekdayLabel}</label>
              <Select
                surface="admin"
                value={String(preset.dayOfWeek)}
                disabled={disabled}
                options={copy.cronWeekdayNames.map((name, index) => ({ value: String(index), label: capitalizeFirst(name) }))}
                onChange={(value) => commit({ ...preset, dayOfWeek: Number(value) })}
              />
            </div>
          )}

          {(preset.kind === 'dailyAt' || preset.kind === 'weeklyAt') && (
            <HelpRevealZone className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                {copy.timeUtcLabel}
                <HelpButton surface="admin" title={copy.timeUtcLabel}>
                  {copy.timeUtcHint}
                </HelpButton>
              </label>
              <Input
                type="time"
                value={timeString(preset.hourUtc, preset.minuteUtc)}
                disabled={disabled}
                onChange={(e) => {
                  const parsed = parseTimeString(e.target.value)
                  if (parsed) commit({ ...preset, hourUtc: parsed.hour, minuteUtc: parsed.minute })
                }}
              />
            </HelpRevealZone>
          )}

          {preset.kind === 'custom' && (
            <HelpRevealZone className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                {copy.cronExpressionLabel}
                <HelpButton surface="admin" title={copy.cronExpressionLabel}>
                  {copy.cronExpressionHint}
                </HelpButton>
              </label>
              <Input
                value={preset.expression}
                disabled={disabled}
                error={!customValid}
                onChange={(e) => commit({ kind: 'custom', expression: e.target.value })}
                className="font-mono text-[13px] tracking-wide"
              />
              {customError && <p className="text-xs font-medium text-rose-700">{customError}</p>}
            </HelpRevealZone>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-1.5 text-[10px] font-semibold tracking-[.08em] text-neutral-400 uppercase">
            {scheduleDirty ? copy.previewLabelDraft : copy.previewLabelSaved}
          </p>
          {previewDates ? (
            <ol className="list-none space-y-0.5 p-0 text-[13px] tabular-nums text-neutral-800">
              {previewDates.map((date) => (
                <li key={date.toISOString()}>{formatYerevanUpcoming(date, locale, copy.today, copy.tomorrow)}</li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-neutral-400">{copy.previewNoResult}</p>
          )}
        </div>
      </div>
    </div>
  )
}
