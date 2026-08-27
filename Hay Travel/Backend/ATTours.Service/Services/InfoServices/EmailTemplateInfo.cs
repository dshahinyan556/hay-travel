using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение шаблонов писем заказов. В отличие от SiteSettingsInfo слияния «каталог + БД»
    // здесь нет: все 4 строки засеяны миграцией AddEmailTemplates, и виртуальных записей
    // быть не может. Каталог в коде (EmailPlaceholders) отвечает только за токены и подписи.
    public class EmailTemplateInfo : EntityInfoBase<EmailTemplate>
    {
        public EmailTemplateInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public EmailTemplateInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public EmailTemplateInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        // GetOrderedAsync удалён (редизайн 2026-08-23): порядок событий в админке теперь
        // задаёт NotificationSettingsInfo.GetEventsAsync — она же сшивает шаблон с каналом
        // и получателями. Здесь остаётся только чтение по ключу для отправки писем.

        // null — строки для ключа нет (после сида не должно случаться; контроллер отвечает 404,
        // а OrderNotificationService на null просто не шлёт письмо).
        public async Task<EmailTemplate?> GetByKeyAsync(EmailActionKey key)
        {
            var templates = await GetAllAsync(template => template.ActionKey == key);
            return templates.FirstOrDefault();
        }
    }
}
