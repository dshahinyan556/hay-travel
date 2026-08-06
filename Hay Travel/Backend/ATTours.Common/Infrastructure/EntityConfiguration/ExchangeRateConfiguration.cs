using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class ExchangeRateConfiguration : IEntityTypeConfiguration<ExchangeRate>
    {
        public void Configure(EntityTypeBuilder<ExchangeRate> builder)
        {
            builder.ToTable(nameof(ExchangeRate));

            builder.Property(x => x.Code)
                .IsRequired()
                .HasMaxLength(3);

            // Идентичность строки — код валюты, а не Id: upsert идёт по нему
            // (то же правило, что у SiteSetting.Key).
            builder.HasIndex(x => x.Code)
                .IsUnique();

            // 6 знаков, а не привычные для проекта (18,2): CBA публикует 4-5 знаков
            // для дешёвых валют (RUB 4.4889), а котировки «за 100/за 1000» после
            // нормализации доходят до 0.026655. (18,2) обрезал бы RUB до 4.49 —
            // это ~0.2% ошибки в каждой цене.
            builder.Property(x => x.RatePerUnitAmd)
                .HasPrecision(18, 6);
        }
    }
}
