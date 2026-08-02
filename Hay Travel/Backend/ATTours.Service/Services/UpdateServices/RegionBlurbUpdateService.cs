using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Точечное редактирование тизера региона (RegionTranslationType.Blurb). Имя/слаг/SortOrder
    // региона остаются фиксированными (заведены сидом, David 2026-08-01) — трогает только две
    // строки перевода с Type = Blurb.
    public class RegionBlurbUpdateService : RepositoryCoreBase<Region, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public RegionBlurbUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task UpdateBlurbAsync(int id, string blurbRu, string blurbEn)
        {
            var region = await EntityRepository.AsQueryable()
                                               .Include(x => x.Translations)
                                               .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                         ?? throw new ErrorModelException(GlobalErrorCode.RegionNotFound, HttpStatusCode.NotFound, $"Region with id {id} not found.");

            Upsert(region, LanguageCode.Russian, blurbRu);
            Upsert(region, LanguageCode.English, blurbEn);

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }

        private static void Upsert(Region region, LanguageCode languageCode, string value)
        {
            var existing = region.Translations.FirstOrDefault(
                t => t.Type == RegionTranslationType.Blurb && t.LanguageCode == languageCode);

            if (existing is not null)
            {
                existing.Value = value;
                return;
            }

            region.Translations.Add(new RegionTranslation
            {
                RegionId = region.Id,
                Type = RegionTranslationType.Blurb,
                LanguageCode = languageCode,
                Value = value
            });
        }
    }
}
