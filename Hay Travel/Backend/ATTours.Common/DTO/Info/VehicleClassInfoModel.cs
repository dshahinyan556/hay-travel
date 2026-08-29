namespace ATTours.Common.DTO.Info
{
    // Справочник классов авто (батч 2026-08-29, решение 0.7) — вкладка в Справочниках,
    // тот же контракт, что у TagInfoModel. Цена здесь НЕ живёт: она на связке
    // «трансфер x класс» (TransferPriceInfoModel).
    public class VehicleClassInfoModel
    {
        public int Id { get; set; }
        // Вместимость, мест (пассажиров, без водителя).
        public int Capacity { get; set; }
        // Лимит багажа в «единицах»: средний чемодан = 3, большой = 5 (решение 0.13).
        public int LuggageCapacity { get; set; }
        public int SortOrder { get; set; }
        // Скрыть класс из выбора, не удаляя его (удалить занятый класс нельзя — CatalogEntryInUse).
        public bool IsActive { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
