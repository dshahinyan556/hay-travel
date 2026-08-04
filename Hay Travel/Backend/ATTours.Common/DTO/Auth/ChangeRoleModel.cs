using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    public class ChangeRoleModel
    {
        [Required]
        public int UserId { get; set; }

        [Required]
        public int RoleId { get; set; }
    }
}
