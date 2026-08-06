using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Двухстадийный флоу смены email (B8, 2026-08-06): код на СТАРЫЙ email -> подтверждение
    // кода -> ввод НОВОГО email -> ссылка-подтверждение на новый email. Не расширяет UserToken
    // (ADR 006): его форма (один Token/ExpiresAt/UsedAt на Type) не подходит для 2-стадийного
    // флоу, которому вдобавок нужно пронести доп. значение (новый email) между стадиями —
    // отдельная сущность, 1:1 опционально с User, по той же логике, что раньше была отдельная
    // таблица PasswordRecovery (до генерализации в UserToken).
    [EntityTypeConfiguration(typeof(EmailChangeRequestConfiguration))]
    public class EmailChangeRequest : EntityBase
    {
        public int UserId { get; set; }
        public User User { get; set; }

        // Шаг 1-2: числовой код (RandomTokenGenerator.CreateNumericCode) на текущий email.
        public string OldEmailCode { get; set; }
        public DateTime OldEmailRequestedAtUtc { get; set; }
        public DateTime OldEmailExpiresAtUtc { get; set; }

        // Null, пока код не подтверждён — отпирает шаг 3 (RequestNewEmail).
        public DateTime? OldEmailConfirmedAtUtc { get; set; }

        // Шаг 3-4: адрес, на который переходит учётка, и непрозрачный токен-ссылка
        // (RandomTokenGenerator.Create()) на подтверждение.
        public string PendingNewEmail { get; set; }
        public string NewEmailToken { get; set; }
        public DateTime? NewEmailRequestedAtUtc { get; set; }
        public DateTime? NewEmailExpiresAtUtc { get; set; }

        // Тот же аудит-контракт, что UserToken.RequestIp/UserAgent.
        public string RequestIp { get; set; }
        public string UserAgent { get; set; }

        // Ставится, когда NewEmailToken реально применён (User.Email изменён).
        public DateTime? UsedAtUtc { get; set; }
    }
}
