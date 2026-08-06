using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    // Шаг 4 email-change флоу (B8): переход по ссылке из письма на НОВЫЙ email.
    public class ConfirmEmailChangeModel
    {
        [Required]
        [MaxLength(256)]
        public string Token { get; set; }
    }
}
