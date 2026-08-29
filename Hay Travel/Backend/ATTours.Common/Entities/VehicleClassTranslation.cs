using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Название класса авто (RU/EN) — показывается ровно как ввёл админ, без изменений.
    // Однополевой перевод, как TagTranslation: типа перевода (enum) нет, поле одно.
    [EntityTypeConfiguration(typeof(VehicleClassTranslationConfiguration))]
    public class VehicleClassTranslation : EntityBase
    {
        public int VehicleClassId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public VehicleClass VehicleClass { get; set; }
    }
}
