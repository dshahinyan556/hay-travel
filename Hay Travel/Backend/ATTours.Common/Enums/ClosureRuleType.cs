namespace ATTours.Common.Enums
{
    // Дискриминатор правила закрытия (ADR 012). Определяет, какое поле правила заполнено:
    // SpecificDate -> Date, Weekly -> DayOfWeek (+ необязательные EffectiveFrom/EffectiveTo).
    public enum ClosureRuleType
    {
        SpecificDate = 1,
        Weekly = 2
    }
}
