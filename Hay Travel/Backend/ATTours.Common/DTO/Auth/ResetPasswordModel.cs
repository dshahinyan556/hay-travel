using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    public class ResetPasswordModel
    {
        [Required]
        [MaxLength(256)]
        public string Token { get; set; }

        [Required]
        [MinLength(8)]
        [MaxLength(128)]
        public string NewPassword { get; set; }
    }
}
