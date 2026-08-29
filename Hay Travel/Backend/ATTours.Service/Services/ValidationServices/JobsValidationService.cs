using ATTours.Common.Infrastructure.Jobs;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Cronos;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация входа экрана «Джобы». В БД не ходит и графа сущностей не имеет, поэтому
    // не наследует EntityValidation*-базы (те сверяют коллекцию Entities с контекстом):
    // проверять нужно ровно две вещи — существует ли ключ в каталоге и разбирается ли
    // cron-строка.
    public static class JobsValidationService
    {
        // Состав задач фиксирован кодом (BackgroundJobCatalog), поэтому неизвестный ключ —
        // это отсутствующий ресурс (404), а не некорректный запрос: /api/Jobs/foo/Run
        // ничем не отличается от обращения к несуществующей задаче.
        public static BackgroundJobDefinition EnsureKnownJob(string key)
        {
            return BackgroundJobCatalog.ByKey(key)
                   ?? throw new ErrorModelException(GlobalErrorCode.UnknownJobKey, HttpStatusCode.NotFound,
                       $"Background job '{key}' is not in the catalog.");
        }

        // Ключи параметров, приехавшие с экрана задачи. Проверка ровно одна и она же —
        // граница безопасности: значения физически лежат в общей таблице SiteSetting, и без
        // сверки с ParameterKeys конкретной задачи роль с jobs:Update правила бы через этот
        // эндпоинт любые настройки сайта, включая те, что закрыты правом settings:Update.
        //
        // Сами значения здесь не проверяются: это делает SiteSettingsValidationService на
        // сохранении (число у Number-ключа, допустимая опция у Select) — дублировать его
        // разбор здесь означало бы две расходящиеся проверки одного и того же.
        public static void ValidateParameterKeys(BackgroundJobDefinition definition, IDictionary<string, string> values)
        {
            // Пустое тело — не «нечего менять», а почти наверняка ошибка клиента: PATCH без
            // единого ключа молча вернул бы 200 и неизменённую карточку.
            if (values is null || values.Count == 0)
                throw new ErrorModelException(GlobalErrorCode.InvalidRequestParam, HttpStatusCode.BadRequest,
                    $"No parameter values supplied for background job '{definition.Key}'.");

            foreach (var key in values.Keys)
            {
                // Ordinal: ключ настройки — часть контракта API, а не пользовательский ввод
                // (то же правило, что у ключа самой задачи).
                if (!definition.ParameterKeys.Contains(key, StringComparer.Ordinal))
                    throw new ErrorModelException(GlobalErrorCode.UnknownJobParameter, HttpStatusCode.BadRequest,
                        $"Site setting '{key}' is not a parameter of background job '{definition.Key}'.");
            }
        }

        // Разбор cron-строки ДО сохранения. Иначе битое расписание уехало бы в БД, а
        // планировщик отверг бы его уже при RescheduleAsync — задача молча осталась бы без
        // триггера, и узнали бы об этом по неотменённым заказам.
        //
        // Пустая строка легальна: это «вернуть дефолт каталога» (см. ScheduledJob.CronExpression).
        //
        // Cronos — та же библиотека, которой разбирает cron сам Hangfire; внутри пакета
        // Hangfire.Core её типы internal, поэтому пакет подключён к слою сервисов напрямую.
        // Это не протечка планировщика в бизнес-слой: Cronos — парсер cron-строк, ничего не
        // планирующий и ни от чего не зависящий.
        public static void ValidateCronExpression(string cronExpression)
        {
            if (string.IsNullOrWhiteSpace(cronExpression))
                return;

            var expression = cronExpression.Trim();

            // 6 полей = формат с секундами (его допускает и Hangfire, и ширина колонки).
            var format = expression.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length == 6
                ? CronFormat.IncludeSeconds
                : CronFormat.Standard;

            try
            {
                CronExpression.Parse(expression, format);
            }
            catch (CronFormatException exception)
            {
                throw new ErrorModelException(GlobalErrorCode.InvalidCronExpression, HttpStatusCode.BadRequest,
                    $"Cron expression '{expression}' is invalid: {exception.Message}");
            }
        }
    }
}
