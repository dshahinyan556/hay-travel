using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using System.ComponentModel.DataAnnotations;

namespace ATTours.BusinessServices.DataConversionModels.DTO.EntityModels
{
    public class RelatedEntityUpdateModel<TRelatedEntity>
        where TRelatedEntity : class, IRelatedEntity
    {
        public int EntityId { get; set; }

        [Required]
        public List<TRelatedEntity> RelatedEntities { get; set; }

    }
}
