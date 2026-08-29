/**
 * Wire-типы `api/Jobs` — экран «Фоновые задачи» (`features/admin/jobs`).
 *
 * Живут в `features/admin/types`, а не в `shared/types`: раздел админский и однофичевый, то же
 * правило, что у `features/admin/types/notifications.ts`/`roles.ts`.
 *
 * Состав задач (ключи, подписи, параметры) фиксирован серверным `BackgroundJobCatalog` — этот
 * файл не перечисляет job-ключи, он только зеркалит форму ответа. Русские подписи по ключу
 * задачи/параметра — в `jobs/lib/jobsCopy.ts` (переводимый текст туда, а не сюда, то же деление,
 * что у остального проекта).
 */

/** Мирроr `ATTours.Common.Enums.JobRunStatus`. Числа проверены по самому enum'у на бэке
 * (`Backend/ATTours.Common/Enums/JobRunStatus.cs`), а не угаданы: `Running = 1`, а не `0`. */
export const JobRunStatus = {
  Running: 1,
  Succeeded: 2,
  Skipped: 3,
  Failed: 4,
} as const
export type JobRunStatus = (typeof JobRunStatus)[keyof typeof JobRunStatus]

/** Мирроr `ATTours.Common.Enums.JobTriggerType`. */
export const JobTriggerType = {
  Schedule: 1,
  Manual: 2,
} as const
export type JobTriggerType = (typeof JobTriggerType)[keyof typeof JobTriggerType]

/** `ATTours.Common/DTO/Info/JobParameterInfoModel.cs`. `displayName` приходит `null` всегда
 * (каталог настроек ещё не объявляет подписи) — экран подписывает параметр сам, по `key`,
 * из словаря `jobsCopy.ts`. */
export interface JobParameterInfoModel {
  key: string
  displayName: string | null
  value: string
  /** `SettingValueType` (`features/admin/lib/enums.ts`) — сегодня у всех параметров задач
   * всегда `Number`, но экран не считает это гарантией (см. `JobParametersCard`). */
  valueType: number
}

/** `ATTours.Common/DTO/Info/ScheduledJobRunInfoModel.cs`. Плоская проекция одного прогона —
 * используется и как строка истории (список), и как страница отчёта (по одному id). */
export interface ScheduledJobRunInfoModel {
  id: number
  jobKey: string
  startedAtUtc: string
  finishedAtUtc: string | null
  status: number
  affectedCount: number
  summary: string | null
  error: string | null
  triggeredBy: number
  actorUserId: number | null
  actorFullName: string | null
}

/** `ATTours.Common/DTO/Info/ScheduledJobInfoModel.cs`. */
export interface ScheduledJobInfoModel {
  key: string
  displayName: string
  isEnabled: boolean
  /** Эффективное расписание: override админа, а если его нет — дефолт каталога. */
  cronExpression: string
  defaultCronExpression: string
  isRunning: boolean
  nextRunAtUtc: string | null
  updatedAtUtc: string | null
  lastRun: ScheduledJobRunInfoModel | null
  parameters: JobParameterInfoModel[]
}

/** `ATTours.Common/DTO/Info/JobRunTriggerResultModel.cs` — тело и успешного 202, и отказного
 * 409 («уже выполняется»), поэтому `adminJobs.ts#runJob` читает его в обоих случаях. */
export interface JobRunTriggerResultModel {
  accepted: boolean
  reason: string | null
  errorCode: number | null
}

/** `ATTours.Common/DTO/Request/SetJobEnabledModel.cs`. */
export interface SetJobEnabledModel {
  isEnabled: boolean
}

/** `ATTours.Common/DTO/Request/UpdateJobCronModel.cs` — пустая строка = «вернуть дефолт
 * каталога», это ЛЕГАЛЬНОЕ значение, а не «нечего менять» (см. `adminJobs.ts#setJobCron`). */
export interface UpdateJobCronModel {
  cronExpression: string
}

/** `ATTours.Common/DTO/Request/UpdateJobParametersModel.cs` — частичная правка: только реально
 * изменённые ключи, а не полный набор параметров задачи. */
export interface UpdateJobParametersModel {
  values: Record<string, string>
}
