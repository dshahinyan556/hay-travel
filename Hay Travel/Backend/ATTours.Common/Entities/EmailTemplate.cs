using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Шаблон письма заказа (Задача E): ровно одна строка на EmailActionKey. Все 4 строки
    // засеяны миграцией AddEmailTemplates, поэтому слияния "каталог + БД" (как у SiteSetting)
    // здесь нет — читаем только БД.
    //
    // Не ITranslatableModel: языковых версий ровно две и они фиксированы (RU/EN), а не
    // открытый набор переводов — таблица переводов ради двух колонок избыточна
    // (редизайн 2026-08-23).
    //
    // Рубильник IsEnabled переехал в NotificationChannel: он принадлежит паре
    // «событие × платформа», а не шаблону письма.
    [EntityTypeConfiguration(typeof(EmailTemplateConfiguration))]
    public class EmailTemplate : EntityBase
    {
        // Идентичность записи — ключ, а не Id: upsert идёт по нему (уникальный индекс).
        public EmailActionKey ActionKey { get; set; }

        // Тема письма, plaintext (теги вырезаются на сохранении). Может содержать {{Токены}}.
        public string Subject { get; set; }

        // Тело письма в HTML, УЖЕ санитизированное (санитизация — на сохранении, §E.5).
        // При рендере повторно не чистится: значения токенов и так HTML-кодируются.
        public string BodyHtml { get; set; }

        // EN-версии. Nullable: пустое поле = "перевод не сделан", письмо тогда уходит
        // RU-версией (фолбэк по каждому полю независимо). Санитизация BodyHtmlEn — та же,
        // что у BodyHtml (ADR 026).
        public string SubjectEn { get; set; }
        public string BodyHtmlEn { get; set; }
    }
}
