using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.Infrastructure.Abstractions.Interfaces
{
    public interface IEntity
    {
        [Key]
        int Id { get; set; }
    }
}
