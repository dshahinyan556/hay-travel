using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Аудит «войти как пользователь» (spec 014 §3.1, ADR 028): одна строка на каждый
    // успешный вход админа в чужой аккаунт. Пишется в той же транзакции, что и отзыв
    // сессий импersonator'а и выдача сессии цели — иначе событие могло бы потеряться.
    [EntityTypeConfiguration(typeof(ImpersonationEventConfiguration))]
    public class ImpersonationEvent : EntityBase
    {
        public int ImpersonatorUserId { get; set; }
        public User Impersonator { get; set; }

        public int TargetUserId { get; set; }
        public User Target { get; set; }

        public DateTime CreatedAtUtc { get; set; }

        // Та же ширина, что у LoginHistory/RefreshToken: источник значений один и тот же
        // (BuildRequestContext, он же режет строки по этим длинам).
        public string IpAddress { get; set; }
        public string UserAgent { get; set; }
    }
}
