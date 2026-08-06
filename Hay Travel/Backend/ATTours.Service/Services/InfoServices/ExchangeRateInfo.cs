using ATTours.BusinessServices.Core.Info;
using ATTours.BusinessServices.Services.UpdateServices;
using ATTours.Common.DTO.Info;
using ATTours.Common.Entities;
using ATTours.Common.Infrastructure.Currencies;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение курсов для публичного сайта + решение «пора обновиться».
    // Проверка свежести живёт здесь, в .Service: «курс старше 3 часов не годится» —
    // бизнес-правило, ему нечего делать ни в репозитории, ни в контроллере.
    public class ExchangeRateInfo : EntityInfoBase<ExchangeRate>
    {
        // Порог свежести. Совпадает с окном, на которое ориентируется фронт.
        private static readonly TimeSpan StaleAfter = TimeSpan.FromHours(3);

        // Троттлинг повторов при недоступном CBA. Без него каждый просмотр страницы
        // во время аварии CBA открывал бы собственный SOAP-вызов и ждал полные 10 секунд —
        // сбой третьей стороны превратился бы в 10-секундную задержку всего сайта.
        private static readonly TimeSpan RetryThrottle = TimeSpan.FromMinutes(10);

        private readonly CancellationToken cancellationToken;

        public ExchangeRateInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public ExchangeRateInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        public ExchangeRateInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        // Единственная точка входа контроллера: при необходимости обновляет курсы
        // и всегда отдаёт то, что есть. Ошибка — ровно один случай: курс не сохранялся
        // ни разу, отдавать физически нечего.
        public async Task<ExchangeRatesModel> GetCurrentAsync()
        {
            var rows = await GetAllAsync();
            var nowUtc = DateTime.UtcNow;

            if (IsStale(rows, nowUtc) && CanAttempt(rows, nowUtc))
            {
                try
                {
                    // На общем контексте и намеренно без using: владелец контекста — этот
                    // экземпляр, и Dispose «одолженного» сервиса закрыл бы соединение
                    // раньше времени (то же правило, что SiteSettingsUpdateService -> SiteSettingsInfo,
                    // только в обратную сторону).
                    var refreshService = new ExchangeRateRefreshService(Context, cancellationToken);
                    if (await refreshService.RefreshAsync())
                        rows = await GetAllAsync();
                }
                // Широкий catch намеренный: для этого эндпоинта у любого сбоя (сеть, TLS,
                // смена схемы у CBA, баг разбора) один и тот же правильный ответ —
                // деградировать, а не падать.
                catch (Exception)
                {
                    // Проглатываем: ниже отдадим то, что уже лежит в БД.
                }
            }

            if (rows.Count == 0)
            {
                throw new ErrorModelException(
                    GlobalErrorCode.ExchangeRatesUnavailable,
                    HttpStatusCode.ServiceUnavailable,
                    "Exchange rates have never been fetched and the rate provider is unreachable.");
            }

            return Compose(rows, IsStale(rows, DateTime.UtcNow));
        }

        // Протухли, если какой-то валюты каталога ещё нет в БД или самый старый
        // из курсов старше порога.
        private static bool IsStale(List<ExchangeRate> rows, DateTime nowUtc)
        {
            if (rows.Count == 0)
                return true;

            var missingCode = CurrencyCatalog.FetchCodes
                                             .Any(code => !rows.Any(row => string.Equals(row.Code, code, StringComparison.OrdinalIgnoreCase)));

            return missingCode || rows.Min(row => row.LastUpdatedUtc) < nowUtc - StaleAfter;
        }

        // Курса нет вообще — идём в CBA всегда (иначе холодный старт никогда не завершится).
        private static bool CanAttempt(List<ExchangeRate> rows, DateTime nowUtc)
            => rows.Count == 0 || rows.Max(row => row.LastAttemptUtc) < nowUtc - RetryThrottle;

        // Склейка «строки БД + метаданные каталога». Профиля AutoMapper нет намеренно:
        // Symbol и RoundingStep не существуют на сущности.
        private static ExchangeRatesModel Compose(List<ExchangeRate> rows, bool isStale)
        {
            var rowsByCode = rows.Where(row => row.Code is not null)
                                 .ToDictionary(row => row.Code, StringComparer.OrdinalIgnoreCase);

            var rates = new List<ExchangeRateInfoModel>(CurrencyCatalog.All.Count);
            foreach (var definition in CurrencyCatalog.All.OrderBy(definition => definition.SortOrder))
            {
                // Базовая валюта в БД не хранится и всегда равна 1 — подставляется из каталога.
                if (definition.IsBase)
                {
                    rates.Add(ToModel(definition, 1m));
                    continue;
                }

                // Валюта, курс которой ещё ни разу не получен (или испорчен нулём),
                // наружу не отдаётся: пустая строка в списке дала бы деление на ноль на фронте.
                if (!rowsByCode.TryGetValue(definition.Code, out var row) || row.RatePerUnitAmd <= 0)
                    continue;

                rates.Add(ToModel(definition, row.RatePerUnitAmd));
            }

            return new ExchangeRatesModel
            {
                BaseCurrency = CurrencyCatalog.Base.Code,
                // MIN, а не MAX: наружу отдаётся возраст самого старого курса — на этот
                // ответ смотрят как на единое целое, и «свежесть» у него по худшей строке.
                LastUpdatedUtc = AsUtc(rows.Min(row => row.LastUpdatedUtc)),
                RateDateUtc = AsUtc(rows.Min(row => row.RateDateUtc)),
                IsStale = isStale,
                Rates = rates
            };
        }

        private static ExchangeRateInfoModel ToModel(CurrencyDefinition definition, decimal ratePerUnitAmd)
            => new()
            {
                Code = definition.Code,
                Symbol = definition.Symbol,
                RatePerUnitAmd = ratePerUnitAmd,
                RoundingStep = definition.RoundingStep
            };

        // SQL Server отдаёт datetime2 с Kind = Unspecified, и такой DateTime уехал бы
        // в JSON без суффикса Z — браузер прочитал бы его как локальное время.
        private static DateTime AsUtc(DateTime value)
            => value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }
}
