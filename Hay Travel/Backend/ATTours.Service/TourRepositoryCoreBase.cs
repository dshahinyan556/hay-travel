using ArmeniaTours.DataLayer;
using ATTours.ContextRepository;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices
{
    public class TourRepositoryCoreBase<TEntity> : RepositoryCoreBase<TEntity, ATToursContextFactory>
        where TEntity : class
    {
        public TourRepositoryCoreBase(string connectionString)
            : base(connectionString)
        {
        }

        public TourRepositoryCoreBase(IApplicationDbContext context)
            : base(context)
        {
        }
    }
}
