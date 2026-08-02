namespace ATTours.Common.Enums
{
    // Дискриминатор заметки тура. Порядок значений соответствует порядку вкладок
    // в форме тура (орг. детали, ограничения, включено, не включено) — Tour -> TourInfoModel
    // сортирует заметки OrderBy(Type).ThenBy(SortOrder).
    // Included/NotIncluded добавлены 2026-08 взамен фронтовых моков "Включено"/"Не включено"
    // на детальной публичного сайта (см. TourClientInfo/TourDetailPage) — не новая сущность,
    // тот же TourNote/TourNoteTemplate, различает только это поле.
    public enum TourNoteType
    {
        OrganizationalDetail = 1,
        Restriction = 2,
        Included = 3,
        NotIncluded = 4
    }
}
