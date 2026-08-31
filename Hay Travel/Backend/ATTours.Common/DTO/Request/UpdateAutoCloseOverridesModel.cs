namespace ATTours.Common.DTO.Request
{
    // Полная замена набора исключений из порога автозакрытия (батч 2026-08-29).
    //
    // Replace-набором, а не add/edit/delete по строке: экран сохраняется одной кнопкой
    // (черновик + «Сохранить», как в Orders), и частичные операции ему не нужны — пустой
    // список означает «исключений нет», а не «нечего делать».
    public class UpdateAutoCloseOverridesModel
    {
        public List<AutoCloseOverrideUpdateModel> Overrides { get; set; }
    }

    // Одно исключение. Id строки не передаётся сознательно: идентичность — продукт
    // (TourAutoCloseOverride.TourId уникален), поэтому серверу достаточно пары
    // «продукт + часы», а клиенту не нужно помнить ключи таблицы.
    public class AutoCloseOverrideUpdateModel
    {
        public int TourId { get; set; }

        // Строго положительное число часов: «ноль» и «минус» означали бы выключенный порог,
        // а выключенное исключение — это отсутствие строки в наборе, а не строка с нулём
        // (проверяет TourAutoCloseOverrideValidationService).
        public int LeadTimeHours { get; set; }
    }
}
