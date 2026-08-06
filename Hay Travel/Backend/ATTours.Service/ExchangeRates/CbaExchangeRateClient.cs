using ATTours.Common.Infrastructure.Currencies;
using System.Globalization;
using System.Text;
using System.Xml;
using System.Xml.Linq;

namespace ATTours.BusinessServices.ExchangeRates
{
    // SOAP 1.1-клиент https://api.cba.am/exchangerates.asmx, операция ExchangeRatesLatest.
    //
    // Ручной конверт + System.Xml.Linq вместо WCF/dotnet-svcutil: одна операция с
    // замороженным контрактом не оправдывает кодогенерацию и новую зависимость в .Service
    // (currency-pricing-sync §3). Контракт ниже проверен живым POST 2026-08-06.
    public class CbaExchangeRateClient : ICbaExchangeRateClient
    {
        private const string ServiceUrl = "https://api.cba.am/exchangerates.asmx";

        // Кавычки вокруг значения обязательны по SOAP 1.1.
        private const string SoapActionHeaderValue = "\"http://www.cba.am/ExchangeRatesLatest\"";

        private const string RequestEnvelope =
            """
            <?xml version="1.0" encoding="utf-8"?>
            <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                           xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                           xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body><ExchangeRatesLatest xmlns="http://www.cba.am/" /></soap:Body>
            </soap:Envelope>
            """;

        private static readonly XNamespace SoapNamespace = "http://schemas.xmlsoap.org/soap/envelope/";
        private static readonly XNamespace CbaNamespace = "http://www.cba.am/";

        // Статический экземпляр: вертикаль конструируется через new (DI охватывает только
        // auth, ADR 005), поэтому IHttpClientFactory здесь недоступен, а новый HttpClient
        // на каждый вызов исчерпал бы сокеты к единственному фиксированному хосту.
        // 10 секунд — не косметика: на «протухшем» пути запрос пользователя ждёт этот вызов.
        private static readonly HttpClient httpClient = new() { Timeout = TimeSpan.FromSeconds(10) };

        public async Task<CbaRatesSnapshot> GetLatestAsync(CancellationToken cancellationToken = default)
        {
            using var content = new StringContent(RequestEnvelope, Encoding.UTF8, "text/xml");
            using var request = new HttpRequestMessage(HttpMethod.Post, ServiceUrl) { Content = content };
            request.Headers.TryAddWithoutValidation("SOAPAction", SoapActionHeaderValue);

            using var response = await httpClient.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var document = await XDocument.LoadAsync(stream, LoadOptions.None, cancellationToken);

            return Parse(document);
        }

        private static CbaRatesSnapshot Parse(XDocument document)
        {
            var result = document.Root?
                                 .Element(SoapNamespace + "Body")?
                                 .Element(CbaNamespace + "ExchangeRatesLatestResponse")?
                                 .Element(CbaNamespace + "ExchangeRatesLatestResult")
                         ?? throw new InvalidOperationException("CBA response does not contain ExchangeRatesLatestResult.");

            var currentDate = ParseCurrentDate(result.Element(CbaNamespace + "CurrentDate")?.Value);

            var rates = new List<CbaRate>(CurrencyCatalog.FetchCodes.Count);
            var ratesElement = result.Element(CbaNamespace + "Rates");
            if (ratesElement is null)
                return new CbaRatesSnapshot(currentDate, rates);

            foreach (var rateElement in ratesElement.Elements(CbaNamespace + "ExchangeRate"))
            {
                var iso = rateElement.Element(CbaNamespace + "ISO")?.Value?.Trim().ToUpperInvariant();

                // Правило 4: только валюты каталога. В ответе ~30 записей, включая XAU/XAG —
                // хранить 30 строк вместо 3 нет смысла.
                if (string.IsNullOrEmpty(iso) || !CurrencyCatalog.IsFetched(iso))
                    continue;

                // Правило 2: InvariantCulture. Rate приходит как "366.25" с точкой; под
                // ru/hy-культурой сервера это распарсилось бы как 36625 — цены в 100 раз мимо.
                if (!TryParseDecimal(rateElement.Element(CbaNamespace + "Amount")?.Value, out var amount) ||
                    !TryParseDecimal(rateElement.Element(CbaNamespace + "Rate")?.Value, out var rate))
                    continue;

                // Правило 3: ни деления на ноль, ни сохранённого нулевого курса
                // (нулевой курс навсегда сломал бы деление на фронте).
                if (amount <= 0 || rate <= 0)
                    continue;

                // Правило 1: нормализация к 1 единице. Сегодня у USD/EUR/RUB Amount = 1,
                // но в том же ответе JPY идёт за 10, IRR за 100, KZT и UZS за 10 —
                // делитель реален, и CBA может перекотировать любую валюту.
                rates.Add(new CbaRate(iso, rate / amount));
            }

            return new CbaRatesSnapshot(currentDate, rates);
        }

        private static bool TryParseDecimal(string? value, out decimal parsed)
            => decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out parsed);

        // CBA присылает xsd:dateTime без смещения (Kind = Unspecified). Трактуем
        // опубликованную дату как есть и помечаем её Utc — переводить дату публикации
        // по часовым поясам нечего, а Unspecified уехало бы в JSON без суффикса Z.
        private static DateTime ParseCurrentDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new InvalidOperationException("CBA response does not contain CurrentDate.");

            var parsed = XmlConvert.ToDateTime(value, XmlDateTimeSerializationMode.Unspecified);
            return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
        }
    }
}
