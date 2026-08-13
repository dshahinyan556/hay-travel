namespace ATTours.Common.Enums
{
    // Действие правила закрытия (ADR 012). Open — исключение-переоткрытие поверх более
    // общего Close (иначе один понедельник нельзя было бы открыть, не удаляя всё
    // recurring-правило).
    public enum ClosureAction
    {
        Close = 1,
        Open = 2
    }
}
