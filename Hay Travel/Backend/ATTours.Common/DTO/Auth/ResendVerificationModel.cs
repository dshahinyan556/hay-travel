using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    // Повторная отправка письма подтверждения (2026-08-27). Раньше единственным способом
    // было заново отправить всю форму регистрации — здесь нужен только адрес.
    public class ResendVerificationModel
    {
        [Required]
        [MaxLength(256)]
        [EmailAddress]
        public string Email { get; set; }
    }
}
