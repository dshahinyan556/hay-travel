using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Одно из предопределённых времён начала продукта (батч 2026-08-29). Список задаёт админ,
    // клиент на сайте выбирает одно из них и изменить не может (снапшот выбора —
    // OrderLine.StartTime). Минимум одно время обязательно у тура/экскурсии; у трансфера
    // коллекция пустая — там время подачи вводит сам клиент при бронировании.
    //
    // Для группового формата пара (дата + это время) — тот ключ, по которому считается
    // остаток мест из Tour.GroupCapacity.
    [EntityTypeConfiguration(typeof(TourStartTimeConfiguration))]
    public class TourStartTime : EntityBase
    {
        public int TourId { get; set; }
        // Время местное (Ереван), без даты и без таймзоны — TimeOnly, а не DateTime: это
        // «расписание», а не момент времени (тот же выбор, что DateOnly у OrderLine.TourDate).
        public TimeOnly Time { get; set; }
        // Порядок показа в списке; сортировка по самому времени НЕ подразумевается — админ
        // расставляет слоты в своём порядке.
        public int SortOrder { get; set; }
        public Tour Tour { get; set; }
    }
}
