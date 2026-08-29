/**
 * Admin Jobs API — `api/Jobs` (`JobsController.cs`). Гейтится ключом экрана `jobs`: `View` —
 * список, история и один прогон; `Update` — рубильник, cron, параметры И ручной запуск (все
 * четверо меняют поведение планировщика, отдельного действия под запуск в `PermissionAction`
 * нет — см. `AdminScreens.cs`).
 *
 * Создать/удалить задачу нельзя — состав фиксирован серверным `BackgroundJobCatalog`, поэтому
 * здесь нет `createJob`/`deleteJob`.
 */

import { authFetch } from '@/shared/auth'
import { ApiError } from '@/shared/lib/http'
import type {
  JobRunTriggerResultModel,
  ScheduledJobInfoModel,
  ScheduledJobRunInfoModel,
  SetJobEnabledModel,
  UpdateJobCronModel,
  UpdateJobParametersModel,
} from '@/features/admin/types/jobs'

/** GET `api/Jobs` — список экрана: каталог + состояние из БД + последний прогон каждой задачи,
 * в порядке каталога. */
export function getJobs(): Promise<ScheduledJobInfoModel[]> {
  return authFetch<ScheduledJobInfoModel[]>('api/Jobs')
}

/** PATCH `api/Jobs/{key}/Enabled` — рубильник. Ответ — перечитанная карточка задачи (не эхо
 * запроса), поэтому вызывающая сторона получает актуальные `cronExpression`/`nextRunAtUtc`
 * заодно. */
export function setJobEnabled(key: string, model: SetJobEnabledModel): Promise<ScheduledJobInfoModel> {
  return authFetch<ScheduledJobInfoModel>(`api/Jobs/${key}/Enabled`, {
    method: 'PATCH',
    body: JSON.stringify(model),
  })
}

/** PATCH `api/Jobs/{key}/Cron` — переопределение расписания. `cronExpression: ''` — легальное
 * значение («вернуть дефолт каталога»), а не «нечего отправлять». */
export function setJobCron(key: string, model: UpdateJobCronModel): Promise<ScheduledJobInfoModel> {
  return authFetch<ScheduledJobInfoModel>(`api/Jobs/${key}/Cron`, {
    method: 'PATCH',
    body: JSON.stringify(model),
  })
}

/** PATCH `api/Jobs/{key}/Parameters` — параметры задачи (пороги/ретеншены) прямо с её экрана,
 * под правом `jobs:Update` (значения физически лежат в общей таблице настроек, но экран этого
 * не показывает — см. `JobsController.cs`'s doc comment). Частичное тело: только реально
 * изменённые ключи. */
export function setJobParameters(
  key: string,
  model: UpdateJobParametersModel,
): Promise<ScheduledJobInfoModel> {
  return authFetch<ScheduledJobInfoModel>(`api/Jobs/${key}/Parameters`, {
    method: 'PATCH',
    body: JSON.stringify(model),
  })
}

/**
 * POST `api/Jobs/{key}/Run` — «Запустить сейчас». Немедленное действие, вне черновика.
 *
 * Разрешён и у выключенной задачи (сервер это допускает сознательно). Отвечает 202 с
 * `{accepted: true}` при постановке в очередь, ИЛИ 409 с `{accepted: false, reason, errorCode}`,
 * если прогон уже идёт — 409 в терминах контракта НЕ ошибка, а такой же доменный результат, как
 * и 202, поэтому здесь он не пробрасывается дальше `ApiError`, а читается из тела так же, как
 * успех. Дальше — серый баннер «уже выполняется», не красный (checklist §9).
 */
export async function runJob(key: string): Promise<JobRunTriggerResultModel> {
  try {
    return await authFetch<JobRunTriggerResultModel>(`api/Jobs/${key}/Run`, { method: 'POST' })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && err.body) {
      return err.body as JobRunTriggerResultModel
    }
    throw err
  }
}

/** GET `api/Jobs/{key}/Runs?take=` — история прогонов одной задачи, новые сверху. `take` не
 * передаётся отдельным параметром выше 50 — экран не предлагает «показать ещё», сервер и так
 * клампит в диапазон `[1, 200]`. */
export function getJobRuns(key: string, take?: number): Promise<ScheduledJobRunInfoModel[]> {
  const query = take ? `?take=${take}` : ''
  return authFetch<ScheduledJobRunInfoModel[]>(`api/Jobs/${key}/Runs${query}`)
}

/**
 * GET `api/Jobs/{key}/Runs/{runId}` — один прогон, страница отчёта. Прямая загрузка по URL (не
 * поиск в уже открытом списке `getJobRuns`), поэтому обновление страницы/прямой переход по
 * ссылке работают. Отсутствующий прогон — 404 (`RelationalEntityNotFound`); в отличие от
 * `getOrder`/`getUserDetail` этот вызов НЕ даёт 404 просочиться в `AdminErrorBoundary` —
 * `jobRunReportLoader` ловит его сам и рисует собственное пустое состояние «Прогон не найден»
 * (checklist §8: ссылка живёт дольше 90-дневного ретеншена истории).
 */
export async function getJobRun(key: string, runId: number): Promise<ScheduledJobRunInfoModel | null> {
  try {
    return await authFetch<ScheduledJobRunInfoModel>(`api/Jobs/${key}/Runs/${runId}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
