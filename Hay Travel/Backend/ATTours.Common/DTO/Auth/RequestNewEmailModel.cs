using System.ComponentModel.DataAnnotations;

namespace ATTours.Common.DTO.Auth
{
    // Шаг 3 email-change флоу (B8): новый адрес, куда уйдёт ссылка-подтверждение.
    public class RequestNewEmailModel
    {
        [Required]
        [MaxLength(256)]
        [EmailAddress]
        public string NewEmail { get; set; }
    }
}
