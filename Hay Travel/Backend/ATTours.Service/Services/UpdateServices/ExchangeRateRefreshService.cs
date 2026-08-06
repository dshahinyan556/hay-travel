using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.ExchangeRates;
using ATTours.Common.Entities;
using ATTours.Common.Infrastructure.Currencies;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Запись курсов из CBA в БД. Upsert идёт по коду валюты, а не по Id.
    //
    // База — RepositoryCoreBase (как у TourActivationService), а не EntityActionServiceBase:
    // контракт последней «вызывающий передал сущности, сохрани их», а здесь источник
    // данных — HTTP-ответ, и передача пустого Entities была бы ложью о контракте базы
    // (ADR 008, «Смежное решение»).
    public class ExchangeRateRefreshService : RepositoryCoreBase<ExchangeRate, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;
        private readonly ICbaExchangeRateClient client;

        public ExchangeRateRefreshService(CancellationToken cancellationToken = default, ICbaExchangeRateClient? client = null)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
            this.client = client ?? new CbaExchangeRateClient();
        }

        // Конструктор на общем контексте: вызывается из ExchangeRateInfo, который остаётся
        // владельцем контекста.
        public ExchangeRateRefreshService(IApplicationDbContext context, CancellationToken cancellationToken = default, ICbaExchangeRateClient? client = null)
            : base(context)
        {
            this.cancellationToken = cancellationToken;
            this.client = client ?? new CbaExchangeRateClient();
        }

        // true — курсы записаны; false — CBA не ответил или ответил бесполезным,
        // и обновлён только LastAttemptUtc. Курс и LastUpdatedUtc при неудаче
        // не трогаются никогда: старое значение честнее выдуманного.
        public async Task<bool> RefreshAsync()
        {
            // Tracked-загрузка (без AsNoTracking): изменения должны попасть в SaveChanges.
            var existingRows = await EntityRepository.AsQueryable().ToListAsync(cancellationToken);
            var rowsByCode = existingRows.ToDictionary(row => row.Code, StringComparer.OrdinalIgnoreCase);
            var attemptedAtUtc = DateTime.UtcNow;

            CbaRatesSnapshot snapshot;
            try
            {
                snapshot = await client.GetLatestAsync(cancellationToken);
            }
            // Фильтр по токену: отмена запроса пользователем — не сбой CBA, её глушить нечего.
            // Таймаут HttpClient приходит тем же TaskCanceledException, но с неотменённым токеном.
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                await MarkAttemptAsync(existingRows, attemptedAtUtc);
                return false;
            }

            var written = false;
            foreach (var incoming in snapshot.Rates)
            {
                if (incoming.RatePerUnitAmd <= 0 || !CurrencyCatalog.IsFetched(incoming.Iso))
                    continue;

                if (!rowsByCode.TryGetValue(incoming.Iso, out var row))
                {
                    row = new ExchangeRate { Code = incoming.Iso };
                    await EntityRepository.AddAsync(row, cancellationToken);
                    rowsByCode[incoming.Iso] = row;
                }

                row.RatePerUnitAmd = incoming.RatePerUnitAmd;
                row.RateDateUtc = snapshot.CurrentDate;
                row.LastUpdatedUtc = attemptedAtUtc;
                row.LastAttemptUtc = attemptedAtUtc;
                written = true;
            }

            // Ответ пришёл, но ни одной пригодной валюты в нём не оказалось — для
            // вызывающего это такая же неудача, как сетевая: писать нечего.
            if (!written)
            {
                await MarkAttemptAsync(existingRows, attemptedAtUtc);
                return false;
            }

            // Валюты, которых в ответе не было, тоже отмечаем попыткой — иначе
            // их LastAttemptUtc навсегда отстанет и будет дёргать троттлинг.
            foreach (var row in existingRows)
                row.LastAttemptUtc = attemptedAtUtc;

            await EntityRepository.SaveChangesAsync(cancellationToken);
            return true;
        }

        private async Task MarkAttemptAsync(List<ExchangeRate> rows, DateTime attemptedAtUtc)
        {
            if (rows.Count == 0)
                return;

            foreach (var row in rows)
                row.LastAttemptUtc = attemptedAtUtc;

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
