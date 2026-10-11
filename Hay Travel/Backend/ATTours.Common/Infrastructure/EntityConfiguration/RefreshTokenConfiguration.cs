using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> builder)
        {
            builder.ToTable(nameof(RefreshToken));

            // SHA-256 в hex — ровно 64 символа; запас до 128 оставлен на смену алгоритма.
            builder.Property(x => x.TokenHash)
                .IsRequired()
                .HasMaxLength(128);

            builder.HasIndex(x => x.TokenHash)
                .IsUnique();

            builder.Property(x => x.ExpiresAtUtc)
                .IsRequired();

            builder.Property(x => x.CreatedAtUtc)
                .IsRequired();

            builder.Property(x => x.CreatedByIp)
                .HasMaxLength(64);

            // Та же длина, что у остальных аудит-полей с User-Agent (UserToken,
            // LoginHistory, ImpersonationEvent): BuildRequestContext режет строку ровно
            // по 512. Не обязательное и без индекса — поле только для показа в списке
            // устройств (spec 017 §1).
            builder.Property(x => x.CreatedByUserAgent)
                .HasMaxLength(512);

            builder.Property(x => x.ReplacedByTokenHash)
                .HasMaxLength(128);

            // Выбор «запомнить меня» этой сессии (ADR 029): определяет длину скользящего
            // окна ExpiresAtUtc и переносится на ротированный токен.
            builder.Property(x => x.RememberMe)
                .IsRequired()
                .HasDefaultValue(false);

            // Аудит-указатель без FK/навигации (spec 014 §3.2): полный аудит лежит в
            // ImpersonationEvent, здесь — только пометка сессии, чтобы claim imp_by
            // переживал ротацию.
            builder.Property(x => x.ImpersonatedByUserId);

            // Не unique: у пользователя несколько живых сессий одновременно.
            builder.HasIndex(x => x.UserId);
        }
    }
}
