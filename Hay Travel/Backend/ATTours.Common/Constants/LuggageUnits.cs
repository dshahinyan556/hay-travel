namespace ATTours.Common.Constants
{
    // Пересчёт багажа кастомной заявки в «единицы» (решение 0.13 чек-листа
    // checklist-transfers-format-2026-08-29): средний чемодан = 3, большой = 5. С этим
    // числом сравнивается VehicleClass.LuggageCapacity.
    //
    // Курс именованный, а не магический: то же правило показывает конструктор заявки на
    // фронте, и «3»/«5», разъехавшиеся между экраном и бэком, дали бы заявку, которую сайт
    // считает валидной, а сервер отклоняет.
    //
    // «Другое» (LuggageOther) в единицы НЕ переводится: это свободный текст, оценивает его
    // менеджер.
    public static class LuggageUnits
    {
        public const int MediumSuitcase = 3;
        public const int LargeSuitcase = 5;

        public static int Resolve(int mediumCount, int largeCount)
            => Math.Max(mediumCount, 0) * MediumSuitcase + Math.Max(largeCount, 0) * LargeSuitcase;
    }
}
