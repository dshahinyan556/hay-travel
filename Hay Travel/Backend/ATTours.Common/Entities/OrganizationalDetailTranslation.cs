using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(OrganizationalDetailTranslationConfiguration))]
    public class OrganizationalDetailTranslation : EntityBase
    {
        public int OrganizationalDetailId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public OrganizationalDetail OrganizationalDetail { get; set; }
    }
}
