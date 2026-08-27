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

        // «Запомнить меня» (ADR 029). Выбор ПОСЕССИОННЫЙ, на аккаунте не хранится:
        // false (по умолчанию) -> окно неактивности Jwt:InactivityMinutes (1ч) + session-cookie,
        // true -> Jwt:RefreshTokenDays (14д) + постоянная cookie.
        public bool RememberMe { get; set; }
    }
}
