using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    public class RegisterModel
    {
        [Required]
        [MaxLength(128)]
        public string FirstName { get; set; }

        [MaxLength(128)]
        public string LastName { get; set; }

        [Required]
        [MaxLength(64)]
        [MinLength(3)]
        public string Username { get; set; }

        [Required]
        [MaxLength(256)]
        [EmailAddress]
        public string Email { get; set; }

        // Только цифры, до 15 символов — тот же контракт, что уже валидируется на фронте.
        [Required]
        [RegularExpression(@"^\d{1,15}$")]
        public string PhoneNumber { get; set; }

        [Required]
        [MinLength(8)]
        [MaxLength(128)]
        public string Password { get; set; }
    }
}
