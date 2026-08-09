using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class LoginHistoryConfiguration : IEntityTypeConfiguration<LoginHistory>
    {
        public void Configure(EntityTypeBuilder<LoginHistory> builder)
        {
            builder.ToTable(nameof(LoginHistory));

            // Те же ширины, что у RequestIp/UserAgent в UserToken и CreatedByIp в RefreshToken —
            // источник значений один и тот же (AuthController.BuildRequestContext, он же режет
            // строки по этим длинам).
            builder.Property(x => x.IpAddress)
                .IsRequired()
                .HasMaxLength(64);

            builder.Property(x => x.CountryCode)
                .HasMaxLength(2);

            builder.Property(x => x.CountryName)
                .HasMaxLength(128);

            builder.Property(x => x.City)
                .HasMaxLength(128);

            builder.Property(x => x.UserAgent)
                .IsRequired()
                .HasMaxLength(512);

            builder.Property(x => x.LoggedInAtUtc)
                .IsRequired();

            // WithMany() без навигации: коллекция входов на User не нужна никому — история
            // читается только точечно, по конкретному пользователю (LoginHistoryInfo).
            // Cascade — как у RefreshTokens: аудит удалённой строки пользователя осиротеть
            // не должен.
            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Не unique: входов у пользователя сколько угодно.
            builder.HasIndex(x => x.UserId);
        }
    }
}
