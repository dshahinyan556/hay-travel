import { Input } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import { jobsCopy } from '../lib/jobsCopy'
import { isValidParameterNumber } from '../lib/jobsModel'
import { SettingValueType } from '@/features/admin/lib/enums'
import type { JobParameterInfoModel } from '@/features/admin/types/jobs'

export interface JobParametersCardProps {
  parameters: JobParameterInfoModel[]
  /** Only the keys with an unsaved edit — matches the rest of the draft (`OrderDetailPage`'s
   * `LineDraftPatch` convention: absent key = unchanged, present key = the new raw string). */
  draftValues: Record<string, string>
  onChange: (key: string, value: string) => void
  disabled: boolean
  /** Заголовок карточки. По умолчанию «Параметры задачи» — карточка живёт и на списке задач,
   * где те же поля означают параметры ЭКРАНА, а не какой-то одной задачи. */
  title?: string
  /** Пояснение за «?» рядом с заголовком (конвенция админки — подсказка не текстом в вёрстке).
   * У карточки задачи его нет: там смысл карточки задаёт сама задача. */
  titleHint?: string
}

/**
 * «Параметры задачи» — renders ONLY when the job actually has parameters (mockup §05/§11: a job
 * with none simply has no such card, no empty placeholder). One `Input` + unit suffix per
 * parameter, keyed by `SiteSettingKeys` string and captioned from `jobsCopy.ts`'s own dictionary
 * — never a label the backend sent, since `JobParameterInfoModel.displayName` is always `null`
 * today (see that type's doc comment).
 */
export function JobParametersCard({
  parameters,
  draftValues,
  onChange,
  disabled,
  title,
  titleHint,
}: JobParametersCardProps) {
  const copy = useCopy(jobsCopy)

  if (parameters.length === 0) return null

  const cardTitle = title ?? copy.parametersCardTitle

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
      <HelpRevealZone
        as="p"
        enabled={Boolean(titleHint)}
        className="mb-3.5 flex items-center gap-2 text-[11px] font-bold tracking-[.1em] text-neutral-500 uppercase"
      >
        {cardTitle}
        {titleHint && (
          <HelpButton surface="admin" title={cardTitle}>
            {titleHint}
          </HelpButton>
        )}
      </HelpRevealZone>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {parameters.map((parameter) => {
          const known = copy.parameters[parameter.key]
          const value = draftValues[parameter.key] ?? parameter.value
          const isNumber = parameter.valueType === SettingValueType.Number
          const invalid = isNumber && !isValidParameterNumber(value)

          return (
            <HelpRevealZone key={parameter.key} className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                {known?.label ?? parameter.key}
                <HelpButton surface="admin" title={known?.label ?? parameter.key}>
                  {known?.hint ?? copy.parameterUnknownTypeHint}
                </HelpButton>
              </label>
              <div className="flex items-center gap-2.5">
                <Input
                  value={value}
                  disabled={disabled}
                  error={invalid}
                  inputMode={isNumber ? 'numeric' : undefined}
                  onChange={(e) => onChange(parameter.key, e.target.value)}
                  className={isNumber ? 'w-26 tabular-nums' : undefined}
                />
                {known && <span className="text-sm text-neutral-600">{known.unit}</span>}
              </div>
              {invalid && <p className="text-xs font-medium text-rose-700">{copy.parameterNumberError}</p>}
            </HelpRevealZone>
          )
        })}
      </div>
    </div>
  )
}
