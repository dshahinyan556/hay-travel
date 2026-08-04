using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    public class ForgotPasswordModel
    {
        [Required]
        [MaxLength(256)]
        [EmailAddress]
        public string Email { get; set; }
    }
}
