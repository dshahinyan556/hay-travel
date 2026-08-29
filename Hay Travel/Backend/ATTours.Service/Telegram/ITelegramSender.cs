namespace ATTours.BusinessServices.Telegram
{
    // Исходящий транспорт HayTravelNotificationsBot (ADR 031 §1). Send-only: бот дублирует
    // email-уведомления и отвечает на /start, ничего больше. Реализация выбирается в DI по
    // конфигу — ровно как у IEmailSender.
    public interface ITelegramSender
    {
        // false у Dev-реализации (только логирует). Симметрия с IEmailSender.
        bool IsConfigured { get; }

        // Одно текстовое уведомление в конкретный чат. text уже отрендерен
        // (parse_mode=HTML, ограниченный whitelist тегов Telegram) — транспорт ничего
        // не сочиняет. Вложений/мультиполучателей нет (ADR 031 §5).
        Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default);
    }
}
