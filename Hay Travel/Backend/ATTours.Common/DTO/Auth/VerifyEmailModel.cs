using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    public class VerifyEmailModel
    {
        [Required]
        [MaxLength(256)]
        public string Token { get; set; }
    }
}
