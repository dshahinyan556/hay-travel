using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Показ тура в секции «избранное» (IsFeatured) + его порядок (FeaturedSortOrder).
    // По образцу TourActivationService/TourArchivalService: точечные операции без include-графа.
    public class TourFeaturedService : RepositoryCoreBase<Tour, ATToursContextFactory>
    {
        // 6 -> 9 (решение 0.5 батча «Трансферы + формат», 2026-08-29). Единственное место на
        // бэке, где лимит задан числом: текст ошибки собирается из этой же константы, описание
        // GlobalErrorCode.TooManyFeaturedTours приведено к ней вручную. Трансферы участвуют в
        // избранном наравне с турами/экскурсиями (решение 0.4) — отдельного лимита у них нет.
        private const int MaxFeaturedTours = 9;

        private readonly CancellationToken cancellationToken;

        public TourFeaturedService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // Снятие с избранного всегда разрешено. Добавление — не больше MaxFeaturedTours сразу,
        // и новый тур встаёт в конец текущего порядка (админ переставляет его руками в табе
        // «Избранные», если нужно другое место).
        public async Task SetFeaturedAsync(int id, bool isFeatured)
        {
            var tour = await EntityRepository.AsQueryable()
                                             .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.NotFound, $"Tour with id {id} not found.");

            if (isFeatured && !tour.IsFeatured)
            {
                // One fetch covers both the cap and "append at the end" — the featured set is at
                // most MaxFeaturedTours rows, so pulling it into memory is cheaper than a second
                // round trip.
                var currentlyFeatured = await EntityRepository.AsQueryable()
                                                               .Where(x => x.IsFeatured)
                                                               .ToListAsync(cancellationToken);

                if (currentlyFeatured.Count >= MaxFeaturedTours)
                    throw new ErrorModelException(GlobalErrorCode.TooManyFeaturedTours, HttpStatusCode.BadRequest,
                        $"At most {MaxFeaturedTours} tours can be featured at once.");

                tour.FeaturedSortOrder = currentlyFeatured.Count == 0
                    ? 0
                    : currentlyFeatured.Max(x => x.FeaturedSortOrder) + 1;
            }

            tour.IsFeatured = isFeatured;
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }

        // Полный список Id уже избранных туров, в желаемом порядке. Любое расхождение с реальным
        // множеством избранных туров (чужой/лишний/пропущенный Id) -> 400, а не тихая частичная
        // перестановка.
        public async Task ReorderAsync(List<int> orderedIds)
        {
            var featuredTours = await EntityRepository.AsQueryable()
                                                       .Where(x => x.IsFeatured)
                                                       .ToListAsync(cancellationToken);

            var featuredIds = featuredTours.Select(x => x.Id).ToHashSet();
            if (orderedIds.Count != featuredTours.Count || !orderedIds.All(featuredIds.Contains))
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityIds, HttpStatusCode.BadRequest,
                    "OrderedIds must contain exactly the currently featured tours.");

            var toursById = featuredTours.ToDictionary(x => x.Id);
            for (int i = 0; i < orderedIds.Count; i++)
                toursById[orderedIds[i]].FeaturedSortOrder = i;

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
