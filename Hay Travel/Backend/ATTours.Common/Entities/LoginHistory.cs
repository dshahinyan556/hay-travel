using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Журнал успешных входов (C1, 2026-08-09) — информация для админов, на публичном
    // /account не показывается.
    //
    // Не заменяет User.RegisteredIp/LastLoginIp: те несут «последнее известное» одним полем,
    // здесь же история строк. Пишется только в AuthService.LoginAsync — ротация refresh-токена
    // логином не считается.
    [EntityTypeConfiguration(typeof(LoginHistoryConfiguration))]
    public class LoginHistory : EntityBase
    {
        public int UserId { get; set; }
        public User User { get; set; }

        public string IpAddress { get; set; }

        // Резолв по IP на момент входа (DB-IP City Lite). Nullable: базы может не быть
        // вообще, а приватный/неизвестный адрес не резолвится и при её наличии.
        public string CountryCode { get; set; }
        public string CountryName { get; set; }
        public string City { get; set; }

        public string UserAgent { get; set; }

        public DateTime LoggedInAtUtc { get; set; }
    }
}
