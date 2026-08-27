using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class ImpersonationEventConfiguration : IEntityTypeConfiguration<ImpersonationEvent>
    {
        public void Configure(EntityTypeBuilder<ImpersonationEvent> builder)
        {
            builder.ToTable(nameof(ImpersonationEvent));

            builder.Property(x => x.CreatedAtUtc)
                .IsRequired();

            // Те же ширины, что у LoginHistory.IpAddress/UserAgent — значения приходят из
            // того же BuildRequestContext, который по ним же и режет строки.
            builder.Property(x => x.IpAddress)
                .IsRequired()
                .HasMaxLength(64);

            builder.Property(x => x.UserAgent)
                .IsRequired()
                .HasMaxLength(512);

            // NoAction на обеих связях (spec 014 §3.1): пользователи удаляются мягко
            // (User.IsDeleted), а два каскадных пути из одной таблицы в User SQL Server
            // всё равно запрещает.
            builder.HasOne(x => x.Impersonator)
                .WithMany()
                .HasForeignKey(x => x.ImpersonatorUserId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasOne(x => x.Target)
                .WithMany()
                .HasForeignKey(x => x.TargetUserId)
                .OnDelete(DeleteBehavior.NoAction);

            // Оба направления читаются точечно: «в чьи аккаунты входил этот админ» и
            // «кто входил в этот аккаунт».
            builder.HasIndex(x => x.ImpersonatorUserId);
            builder.HasIndex(x => x.TargetUserId);
        }
    }
}
