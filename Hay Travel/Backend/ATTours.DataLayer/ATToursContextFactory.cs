using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.DataLayer;
using Microsoft.EntityFrameworkCore;

namespace ArmeniaTours.DataLayer
{
    public class ATToursContextFactory : ApplicationContextFactoryBase<ATToursContext>
        {
        public override DbContextOptionsBuilder CreateContextOptionBuilder(string connectionString)
        {
            var optionsBuilder = new DbContextOptionsBuilder<ATToursContext>();
            optionsBuilder.UseSqlServer(CommonSettings.Instance.ATToursConnectionString);
            return optionsBuilder;
        }
    }
}
