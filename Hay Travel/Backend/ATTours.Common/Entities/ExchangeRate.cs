using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Курс одной валюты к AMD, полученный от ЦБ Армении (api.cba.am).
    // Одна строка на валюту: добавление валюты = INSERT, а не миграция.
    //
    // AMD здесь НЕ хранится: базовая валюта всегда ровно 1, и строка-константа в БД
    // рано или поздно была бы кем-то отредактирована. AMD подставляется в ответ
    // из CurrencyCatalog (ADR 008, currency-pricing-sync §1).
    //
    // Переводов нет и ITranslatableModel не реализуется: Code — ISO-идентификатор,
    // а символ валюты — глиф, одинаковый во всех языках. Название валюты, если
    // когда-нибудь понадобится, живёт в i18n фронта, а не в таблице переводов.
    [EntityTypeConfiguration(typeof(ExchangeRateConfiguration))]
    public class ExchangeRate : EntityBase
    {
        // ISO-4217 в верхнем регистре: "USD" / "EUR" / "RUB". Идентичность строки —
        // именно код, а не Id (upsert идёт по нему, как у SiteSetting.Key).
        public string Code { get; set; }

        // Сколько AMD стоит ровно 1 единица валюты. Уже нормализовано: CBA отдаёт
        // Rate за Amount единиц (JPY за 10, IRR за 100), деление живёт в CbaExchangeRateClient.
        public decimal RatePerUnitAmd { get; set; }

        // Дата публикации курса на стороне CBA (<CurrentDate> в ответе).
        public DateTime RateDateUtc { get; set; }

        // Когда мы в последний раз ЗАПИСАЛИ значение курса. Основа проверки «старше 3ч».
        public DateTime LastUpdatedUtc { get; set; }

        // Когда мы в последний раз ХОДИЛИ в CBA — успешно или нет. Отдельно от
        // LastUpdatedUtc, чтобы во время недоступности CBA не дёргать его на каждый
        // просмотр страницы (троттлинг повторов, currency-pricing-sync §4).
        public DateTime LastAttemptUtc { get; set; }
    }
}
