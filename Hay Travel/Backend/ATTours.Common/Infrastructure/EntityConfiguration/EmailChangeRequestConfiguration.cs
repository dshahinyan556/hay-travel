using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class EmailChangeRequestConfiguration : IEntityTypeConfiguration<EmailChangeRequest>
    {
        public void Configure(EntityTypeBuilder<EmailChangeRequest> builder)
        {
            builder.ToTable(nameof(EmailChangeRequest));

            builder.Property(x => x.OldEmailCode)
                .IsRequired()
                .HasMaxLength(10);

            builder.Property(x => x.OldEmailRequestedAtUtc)
                .IsRequired();

            builder.Property(x => x.OldEmailExpiresAtUtc)
                .IsRequired();

            builder.Property(x => x.PendingNewEmail)
                .HasMaxLength(256);

            builder.Property(x => x.NewEmailToken)
                .HasMaxLength(256);

            // Filtered: несколько строк с NewEmailToken == null (флоу ещё не дошёл до шага 3)
            // не должны конфликтовать друг с другом на unique-индексе.
            builder.HasIndex(x => x.NewEmailToken)
                .IsUnique()
                .HasFilter("[NewEmailToken] IS NOT NULL");

            builder.Property(x => x.RequestIp)
                .IsRequired()
                .HasMaxLength(64);

            builder.Property(x => x.UserAgent)
                .HasMaxLength(512);

            // 1:1 опционально с User (как раньше PasswordRecovery): один активный флоу смены
            // email на пользователя, апсертится по UserId (см. AuthService.RequestEmailChangeAsync).
            builder.HasIndex(x => x.UserId)
                .IsUnique();

            builder.HasOne(x => x.User)
                .WithOne(x => x.EmailChangeRequest)
                .HasForeignKey<EmailChangeRequest>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
