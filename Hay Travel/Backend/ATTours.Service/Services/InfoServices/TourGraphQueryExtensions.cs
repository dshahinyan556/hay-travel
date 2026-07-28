using ATTours.Common.Entities;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using System.Linq.Expressions;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Единая декларация графа Include для чтения тура целиком.
    // Используется как для NoTracking-чтения (TourInfo), так и для tracked-загрузки
    // при обновлении (TourUpdateService), чтобы цепочка Include не дублировалась.
    public static class TourGraphQueryExtensions
    {
        // TourDetails/AdditionalExpenses объявлены как HashSet<>, поэтому для выбора
        // коллекционной перегрузки Include (а не identity) лямбда приводится к
        // ICollection<> — иначе ThenInclude видит HashSet<> вместо элемента.
        public static IEntityQueryableRepository<Tour> IncludeTourGraph(this IEntityQueryableRepository<Tour> query)
        {
            return query
                .Include((Expression<Func<Tour, ICollection<TourDetail>>>)(x => x.TourDetails))
                    .ThenInclude(td => td.TourDay)
                        .ThenInclude(day => day.Translations)
                .Include((Expression<Func<Tour, ICollection<TourDetail>>>)(x => x.TourDetails))
                    .ThenInclude(td => td.TourDay)
                        .ThenInclude(day => day.GalleryImages)
                .Include((Expression<Func<Tour, ICollection<TourDetail>>>)(x => x.TourDetails))
                    .ThenInclude(td => td.TourDay)
                        .ThenInclude((Expression<Func<TourDay, ICollection<RoutePoint>>>)(day => day.RoutePoints))
                            .ThenInclude(rp => rp.Translations)
                .Include(x => x.Translations)
                .Include((Expression<Func<Tour, ICollection<AdditionalExpense>>>)(x => x.AdditionalExpenses))
                    .ThenInclude(ae => ae.Translations)
                .Include((Expression<Func<Tour, ICollection<OrganizationalDetail>>>)(x => x.OrganizationalDetails))
                    .ThenInclude(od => od.Translations)
                .Include((Expression<Func<Tour, ICollection<Restriction>>>)(x => x.Restrictions))
                    .ThenInclude(r => r.Translations);
        }
    }
}
