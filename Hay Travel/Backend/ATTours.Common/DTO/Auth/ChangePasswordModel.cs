using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    // Смена пароля залогиненным пользователем (в том числе принудительная,
    // когда ForceToChangePass == true).
    public class ChangePasswordModel
    {
        [Required]
        [MaxLength(128)]
        public string CurrentPassword { get; set; }

        [Required]
        [MinLength(8)]
        [MaxLength(128)]
        public string NewPassword { get; set; }
    }
}
