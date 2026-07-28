using ArmeniaTours.DataLayer;
using ATTours.ContextRepository;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.Extensions.DependencyInjection;

namespace ATTours.BusinessServices
{
    public class TourCoreBase : CoreBase<ATToursContextFactory>
    {
        public TourCoreBase(string connectionString) : base(connectionString)
        {
        }

        [ActivatorUtilitiesConstructor]
        public TourCoreBase(IApplicationDbContext context) : base(context)
        {
        }
    }
}
