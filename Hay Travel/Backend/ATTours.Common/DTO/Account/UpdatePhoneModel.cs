namespace ATTours.Common.DTO.Account
{
    // Self-service смена телефона (A4). Формат номера бэкенд не валидирует — международный
    // разбор живёт во фронте (libphonenumber-js); здесь проверяется только длина под
    // фактическую ширину колонки User.PhoneNumber.
    //
    // Пустая строка/null — легитимный ввод: он означает «убрать телефон» (колонка nullable
    // с B1, 2026-08-06), поэтому [Required] здесь намеренно нет.
    public class UpdatePhoneModel
    {
        public string PhoneNumber { get; set; }
    }
}
