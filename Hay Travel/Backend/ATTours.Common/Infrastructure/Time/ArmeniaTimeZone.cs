namespace ATTours.Common.Infrastructure.Time
{
    // Единственное место в решении, где считается «армянское» время. Всё остальное живёт
    // в UTC (см. UtcDateTimeConverters) — и должно продолжать жить: сюда ходят только
    // те, кому нужна граница КАЛЕНДАРНОГО дня по месту оказания услуги (тур начинается
    // утром в Ереване, а не в 00:00 UTC).
    public static class ArmeniaTimeZone
    {
        // IANA-id (Linux-контейнер) -> Windows-id (локальная разработка) -> захардкоженный
        // UTC+4. Третья ступень существует не для красоты: без пакета tzdata в образе
        // FindSystemTimeZoneById бросает TimeZoneNotFoundException, и приложение падало бы
        // на старте из-за отсутствующего файла таймзоны. Армения не переводит часы с 2012
        // года, поэтому фиксированный офсет без правил DST — корректная замена, а не «почти».
        private const string IanaId = "Asia/Yerevan";
        private const string WindowsId = "Caucasus Standard Time";

        private static readonly Lazy<TimeZoneInfo> timeZone = new(Resolve);

        public static TimeZoneInfo TimeZone => timeZone.Value;

        private static TimeZoneInfo Resolve()
        {
            foreach (var id in new[] { IanaId, WindowsId })
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById(id);
                }
                catch (TimeZoneNotFoundException) { }
                catch (InvalidTimeZoneException) { }
            }

            return TimeZoneInfo.CreateCustomTimeZone("Armenia Standard Time",
                TimeSpan.FromHours(4), "Armenia Standard Time", "Armenia Standard Time");
        }

        // Момент начала календарного дня date по армянскому времени, выраженный в UTC.
        // Для 2026-08-28 это 2026-08-27T20:00:00Z. Возвращается DateTime с Kind = Utc —
        // сравнивать с DateTime.UtcNow можно напрямую.
        public static DateTime DayStartUtc(DateOnly date)
        {
            // Kind = Unspecified (так отдаёт DateOnly.ToDateTime) — обязательное условие
            // ConvertTimeToUtc: с Kind = Utc он бы бросил исключение вместо конвертации.
            var localMidnight = date.ToDateTime(TimeOnly.MinValue);

            // У фиксированного UTC+4 несуществующего времени не бывает; проверка нужна на
            // случай, если ОС когда-нибудь вернёт для Еревана зону с правилами перехода —
            // тогда лучше отдать корректную границу по офсету, чем уронить джобу.
            if (TimeZone.IsInvalidTime(localMidnight))
                return DateTime.SpecifyKind(localMidnight - TimeZone.BaseUtcOffset, DateTimeKind.Utc);

            return TimeZoneInfo.ConvertTimeToUtc(localMidnight, TimeZone);
        }

        // Какое сегодня число в Армении на момент utcNow. Нужен там, где «сегодня» —
        // это день клиента и гида, а не день сервера.
        public static DateOnly TodayInArmenia(DateTime utcNow)
        {
            // ConvertTimeFromUtc отказывается работать с Kind = Local, а Unspecified
            // трактует как UTC — приводим явно, чтобы результат не зависел от того,
            // откуда пришло значение.
            var normalized = utcNow.Kind == DateTimeKind.Local
                ? utcNow.ToUniversalTime()
                : DateTime.SpecifyKind(utcNow, DateTimeKind.Utc);

            return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(normalized, TimeZone));
        }
    }
}
