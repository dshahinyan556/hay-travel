using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    // Шаг 2 email-change флоу (B8): подтверждение числового кода, присланного на старый email.
    public class ConfirmEmailChangeCodeModel
    {
        [Required]
        [MaxLength(10)]
        public string Code { get; set; }
    }
}
