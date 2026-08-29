using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.ClientAPI.Authorization;
using ATTours.ClientAPI.Extensions;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Request;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Settings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace ATTours.ClientAPI.Controllers
{
    // Экран «Фоновые задачи»: состав задач фиксирован BackgroundJobCatalog в коде, поэтому
    // Create/Delete здесь нет — есть только чтение, рубильник, расписание и ручной запуск
    // (ключ прав jobs: View — список и история, Update — всё остальное).
    //
    // Стиль контроллеров проекта: сервисы через new + using. Исключение — IJobDispatcher
    // (ADR 005): его реализация обёрнута вокруг singleton'ов планировщика, собрать её `new`
    // нельзя в принципе, поэтому она приходит из контейнера.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class JobsController(IMapper mapper, IJobDispatcher jobDispatcher) : Controller
    {
        // Глубина истории по умолчанию и потолок. Превышение клампится, а не отвергается:
        // размер страницы — не бизнес-правило, и 400 в ответ на «дай побольше» ничего не
        // защищает, только ломает клиент.
        private const int DefaultRunsTake = 50;
        private const int MaxRunsTake = 200;

        // Список задач: каталог + состояние из БД + последний прогон. Порядок — порядок
        // каталога (он же порядок строк на экране).
        [HttpGet]
        [RequiresPermission(AdminScreens.Jobs, PermissionAction.View)]
        public async Task<List<ScheduledJobInfoModel>> GetAllAsync(CancellationToken cancellationToken)
        {
            using var info = new ScheduledJobInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<List<ScheduledJobInfoModel>>(await info.GetViewsAsync());
        }

        // Рубильник. Ответ — перечитанная карточка задачи: после смены состояния фронту
        // нужен и актуальный cron, и последний прогон, а не эхо запроса.
        [HttpPatch]
        [Route("{key}/Enabled")]
        [RequiresPermission(AdminScreens.Jobs, PermissionAction.Update)]
        public async Task<ScheduledJobInfoModel> SetEnabledAsync(string key, [FromBody] SetJobEnabledModel model,
            CancellationToken cancellationToken)
        {
            using (var updateService = new ScheduledJobUpdateService(jobDispatcher, cancellationToken))
                await updateService.SetEnabledAsync(key, model.IsEnabled);

            return await ReadAsync(key, cancellationToken);
        }

        // Переопределение расписания. Пустая строка = вернуть дефолт каталога (отдельного
        // эндпоинта сброса поэтому нет). Синтаксис проверяется до сохранения.
        [HttpPatch]
        [Route("{key}/Cron")]
        [RequiresPermission(AdminScreens.Jobs, PermissionAction.Update)]
        public async Task<ScheduledJobInfoModel> SetCronAsync(string key, [FromBody] UpdateJobCronModel model,
            CancellationToken cancellationToken)
        {
            using (var updateService = new ScheduledJobUpdateService(jobDispatcher, cancellationToken))
                await updateService.SetCronAsync(key, model.CronExpression);

            return await ReadAsync(key, cancellationToken);
        }

        // Параметры задачи (пороги/ретеншены) правятся прямо на её экране — одним черновиком
        // с рубильником и расписанием, без ухода в «Настройки сайта».
        //
        // Вход именно здесь и именно под jobs:Update, хотя значения физически лежат в
        // SiteSetting: PUT api/SiteSettings/Update гейтится правом settings:Update, и роль,
        // которой доверили задачи, иначе не сохранила бы параметр собственной задачи. Правкой
        // остальных настроек сайта этот эндпоинт не становится — ключ обязан быть в
        // ParameterKeys именно этой задачи, иначе 400 UnknownJobParameter.
        [HttpPatch]
        [Route("{key}/Parameters")]
        [RequiresPermission(AdminScreens.Jobs, PermissionAction.Update)]
        public async Task<ScheduledJobInfoModel> SetParametersAsync(string key, [FromBody] UpdateJobParametersModel model,
            CancellationToken cancellationToken)
        {
            using (var updateService = new ScheduledJobUpdateService(jobDispatcher, cancellationToken))
                await updateService.SetParametersAsync(key, model.Values);

            return await ReadAsync(key, cancellationToken);
        }

        // «Запустить сейчас». Отвечает 202, а не 200: задача уходит в очередь планировщика,
        // и её исход читается из истории (GET api/Jobs/{key}/Runs), а не из этого ответа.
        //
        // Выключенная задача НЕ отвергается здесь: администратор вправе нажать кнопку, а
        // отказ должен быть виден там же, где остальные исходы — строкой Skipped «Задача
        // выключена» в истории (её пишет BackgroundJobRunner). Молчаливого «ничего не
        // произошло» в этом сценарии нет.
        [HttpPost]
        [Route("{key}/Run")]
        [RequiresPermission(AdminScreens.Jobs, PermissionAction.Update)]
        public async Task<ActionResult<JobRunTriggerResultModel>> RunAsync(string key, CancellationToken cancellationToken)
        {
            JobsValidationService.EnsureKnownJob(key);

            using var info = new ScheduledJobInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            // Дешёвый pre-check: настоящую гонку добивает распределённая блокировка внутри
            // диспетчера, но без этой проверки админ получал бы 202 на запуск, который
            // планировщик тут же молча выбросит.
            if (await info.HasOpenRunAsync(key))
            {
                return Conflict(new JobRunTriggerResultModel
                {
                    Accepted = false,
                    Reason = "Задача уже выполняется.",
                    ErrorCode = (int)GlobalErrorCode.JobAlreadyRunning
                });
            }

            await jobDispatcher.EnqueueAsync(key, JobTriggerType.Manual, User.GetUserId(),
                await ResolveActorFullNameAsync(cancellationToken), cancellationToken);

            return Accepted(new JobRunTriggerResultModel { Accepted = true });
        }

        // История прогонов конкретной задачи, новые сверху.
        [HttpGet]
        [Route("{key}/Runs")]
        [RequiresPermission(AdminScreens.Jobs, PermissionAction.View)]
        public async Task<List<ScheduledJobRunInfoModel>> GetRunsAsync(string key, CancellationToken cancellationToken,
            [FromQuery] int take = DefaultRunsTake)
        {
            JobsValidationService.EnsureKnownJob(key);

            var effectiveTake = take <= 0 ? DefaultRunsTake : Math.Min(take, MaxRunsTake);

            using var info = new ScheduledJobInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<List<ScheduledJobRunInfoModel>>(await info.GetRunsAsync(key, effectiveTake));
        }

        // Один прогон по id — страница отчёта. Отдельный эндпоинт, а не фильтр по списку:
        // открытая по ссылке страница отчёта иначе тянула бы всю историю задачи ради
        // одной строки.
        [HttpGet]
        [Route("{key}/Runs/{runId:int}")]
        [RequiresPermission(AdminScreens.Jobs, PermissionAction.View)]
        public async Task<ScheduledJobRunInfoModel> GetRunAsync(string key, int runId, CancellationToken cancellationToken)
        {
            JobsValidationService.EnsureKnownJob(key);

            using var info = new ScheduledJobInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            // Прогон читается вместе с ключом задачи: id чужой задачи под этим маршрутом —
            // это «такого ресурса нет», а не молчаливая выдача соседней записи. Код тот же
            // общий RelationalEntityNotFound, которым отвечают на отсутствующую строку
            // остальные экраны — своего кода «прогон не найден» заводить незачем
            // (UnknownJobKey тут врал бы: ключ задачи как раз известен).
            var run = await info.GetRunAsync(key, runId)
                      ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                          $"Run '{runId}' of background job '{key}' was not found.");

            return mapper.Map<ScheduledJobRunInfoModel>(run);
        }

        // Перечитываем после записи ровно тем же путём, что и список: карточка задачи
        // собирается из трёх источников, и собирать её вторым способом ради одного ответа
        // означало бы две расходящиеся проекции.
        private async Task<ScheduledJobInfoModel> ReadAsync(string key, CancellationToken cancellationToken)
        {
            using var info = new ScheduledJobInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            var view = (await info.GetViewsAsync())
                       .FirstOrDefault(item => item.Definition.Key == key)
                       ?? throw new ErrorModelException(GlobalErrorCode.UnknownJobKey, HttpStatusCode.NotFound,
                           $"Background job '{key}' is not in the catalog.");

            return mapper.Map<ScheduledJobInfoModel>(view);
        }

        // Снапшот имени инициатора для строки истории: в токене ФИО нет (там только id и
        // права), а ActorFullName в ScheduledJobRun денормализован намеренно — журнал
        // прогонов не должен зависеть от жизненного цикла учётки.
        private async Task<string?> ResolveActorFullNameAsync(CancellationToken cancellationToken)
        {
            using var userInfo = new UserInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            var actor = await userInfo.GetByIdAsync(User.GetUserId(), cancellationToken);
            if (actor is null)
                return null;

            var fullName = $"{actor.FirstName} {actor.LastName}".Trim();
            return string.IsNullOrWhiteSpace(fullName) ? actor.Username : fullName;
        }
    }
}
