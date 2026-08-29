using ATTours.Common.Infrastructure.Time;

namespace ATTours.BusinessServices.Services.Availability
{
    // «Живой» порог автозакрытия дня: попадает ли дата в окно, внутри которого бронировать
    // уже поздно. Чистая функция без БД — как и ClosureRuleResolver рядом, потому что это
    // правило, а не данные.
    //
    // Зачем отдельно от ClosureRule, если фоновая задача и так материализует правило на
    // каждый закрытый день: задача тикает раз в час, а между тиками дата обязана быть
    // недоступна уже — и в валидации заказа, и в публичном списке закрытых дат, из которого
    // дата-пикер сайта берёт, что гасить. Материализованное правило нужно не для запрета,
    // а для того чтобы админ-календарь мог показать причину.
    //
    // Три будущих потребителя обязаны звать именно этот метод, а не пересчитывать порог
    // у себя: разъехавшиеся копии одного порога — это дата, закрытая на бэке и открытая
    // в календаре.
    public static class AutoClosureWindow
    {
        // true = бронировать date уже нельзя.
        //
        // Точка отсчёта — начало календарного дня date по времени Армении (не UTC-полночь
        // и не время сервера): тур начинается утром на месте, и «за сутки до» означает
        // сутки до ереванского утра.
        public static bool IsWithinAutoCloseWindow(DateOnly date, int leadTimeHours, DateTime nowUtc)
        {
            // Порог выключен: 0 (или отрицательное значение как результат ручной правки
            // настройки) не должен закрывать вообще всё — это чинится в админке, а не
            // ценой недоступного календаря.
            if (leadTimeHours <= 0)
                return false;

            var dayStartUtc = ArmeniaTimeZone.DayStartUtc(date);
            var closesAtUtc = dayStartUtc.AddHours(-leadTimeHours);

            var normalizedNow = nowUtc.Kind == DateTimeKind.Local
                ? nowUtc.ToUniversalTime()
                : DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc);

            // Прошедшие даты тоже попадают под условие — и это правильно: они и так
            // недоступны, отдельной проверки «дата в прошлом» здесь не нужно.
            return normalizedNow >= closesAtUtc;
        }
    }
}
