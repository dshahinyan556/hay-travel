using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.Infrastructure.Abstractions.Interfaces
{
    public interface IRelatedEntity : IEntity
    {
        [Key]
        public int RelatedEntityId { get; set; }
    }
}
