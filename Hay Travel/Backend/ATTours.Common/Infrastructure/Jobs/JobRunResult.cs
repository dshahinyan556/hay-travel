using ATTours.Common.Enums;

namespace ATTours.Common.Infrastructure.Jobs
{
    // Итог одного прогона хендлера. Хендлер НЕ бросает исключение как штатный способ
    // сообщить о проблеме и не возвращает void: результат целиком ложится в
    // ScheduledJobRun, а «молчаливых» прогонов в истории быть не должно.
    //
    // Создаётся только фабриками ниже — конструктор закрыт, чтобы нельзя было собрать
    // Failed без текста ошибки или Succeeded с отрицательным счётчиком.
    public class JobRunResult
    {
        private JobRunResult(JobRunStatus status, int affectedCount, string summary, string error)
        {
            Status = status;
            AffectedCount = affectedCount;
            Summary = summary ?? string.Empty;
            Error = error;
        }

        public JobRunStatus Status { get; }

        // Сколько сущностей задача реально тронула (отменённых заказов, удалённых строк).
        // 0 у Skipped/Failed — это не «ничего не нашлось», а «до работы не дошло».
        public int AffectedCount { get; }

        // Человекочитаемая строка для админского экрана, по-русски. Не перевод контента —
        // внутренний операционный лог, ITranslatableModel здесь не нужен.
        public string Summary { get; }

        // Текст исключения (сообщение + тип). null у всех статусов, кроме Failed.
        public string Error { get; }

        public static JobRunResult Succeeded(int affectedCount, string summary)
            => new(JobRunStatus.Succeeded, affectedCount < 0 ? 0 : affectedCount, summary, null);

        // Штатный отказ от работы: нечего делать, конфиг противоречив, задача выключена
        // на лету. Не Failed — иначе админ не отличит «сегодня нечего отменять» от поломки.
        public static JobRunResult Skipped(string reason)
            => new(JobRunStatus.Skipped, 0, reason, null);

        // AffectedCount осознанно 0: часть работы могла успеть пройти, но доверять
        // недосчитанному числу в отчёте нельзя.
        public static JobRunResult Failed(string summary, string error)
            => new(JobRunStatus.Failed, 0, summary, error ?? string.Empty);
    }
}
