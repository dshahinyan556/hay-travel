using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    // Одно поле под логин и почту: пользователь не обязан помнить, чем он регистрировался.
    public class LoginModel
    {
        [Required]
        [MaxLength(256)]
        public string UsernameOrEmail { get; set; }

        [Required]
        [MaxLength(128)]
        public string Password { get; set; }
    }
}
