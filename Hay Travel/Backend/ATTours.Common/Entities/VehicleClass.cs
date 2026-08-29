using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Справочник классов авто для трансферов (батч 2026-08-29) — общий каталог, вкладка в
    // Справочниках, по образцу Tag/ExpenseTemplate. Цена живёт не здесь, а на связке
    // «трансфер × класс» (TransferPrice): один и тот же класс на разных трансферах стоит
    // по-разному.
    [EntityTypeConfiguration(typeof(VehicleClassConfiguration))]
    public class VehicleClass : EntityBase
    {
        // Вместимость, мест (пассажиров, без водителя).
        public int Capacity { get; set; }
        // Лимит багажа в «единицах»: средний чемодан = 3, большой = 5 (решение 0.13 чек-листа).
        // Сверяется с багажом заявки только если клиент его вообще заполнил.
        public int LuggageCapacity { get; set; }
        public int SortOrder { get; set; }
        // Скрыть класс из выбора, не удаляя его: удалить класс, который уже участвует в
        // ценах/бронях, нельзя (FK Restrict + гард в сервисе удаления).
        public bool IsActive { get; set; }
        public HashSet<VehicleClassTranslation> Translations { get; set; } = [];
        // Inverse — для конфигурации FK (Restrict) и проверки «в использовании» при удалении.
        public HashSet<TransferPrice> TransferPrices { get; set; } = [];
    }
}
