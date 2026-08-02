using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(UserRoleConfiguration))]
    public class UserRole : EntityBase
    {
        public string Description { get; set; }
        public RoleType Type { get; set; }
        public HashSet<User> Users { get; set; } = [];
    }
}
