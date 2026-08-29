using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(TourConfiguration))]
    public class Tour : EntityBase
    {
        public TourType Type { get; set; }
        // Формат проведения (батч 2026-08-29): индивидуальный / групповой / оба. Обязателен
        // у тура и экскурсии, ВСЕГДА null у трансфера (TourType.Transfer) — у трансфера
        // формата не бывает, там цена определяется классом авто. Существующим продуктам
        // миграция проставила Individual — прежнее поведение цены.
        public TourFormat? Format { get; set; }
        // Групповой формат: цена ЗА ЧЕЛОВЕКА (умножается на число гостей, без тирной
        // наценки 1-4/5-6/7+ и без скрытия цены на 7+). null у индивидуального формата
        // и у трансфера; обязательна при Format == Group/Both.
        public decimal? GroupPricePerPerson { get; set; }
        // Групповой формат: мест на выезд — ОДНО число на весь продукт, а не на дату.
        // Остаток считается по паре (дата + выбранное время старта): занято = Σ GuestCount
        // по строкам заказов на этот слот. null у индивидуального формата и у трансфера.
        public int? GroupCapacity { get; set; }
        public decimal? TotalPrice { get; set; }
        public bool IsActive { get; set; }
        // Мягкое удаление: архивный тур скрыт из основного списка, но восстановим.
        // Отдельно от IsActive (публикация на сайте) — это разные состояния.
        public bool IsArchived { get; set; }
        // Показ в секции «избранное» на главной (не более 6 одновременно — TourFeaturedService).
        public bool IsFeatured { get; set; }
        // Порядок внутри избранного (0-based); осмыслен только пока IsFeatured == true.
        public int FeaturedSortOrder { get; set; }
        // Показывать ли блок предоплаты на публичной странице тура (B12, 2026-08-13). Сама
        // сумма предоплаты по-прежнему глобальная константа (OrderCreationService.
        // ResolvePrepayment) — это только видимость блока, не per-tour процент.
        public bool RequiresPrepayment { get; set; }
        // Скидка тура (Фаза 3, checklist-orders-redesign.txt): ОДНО активное правило на сам
        // тур, не список тегов (заменяет прежний TagType.Discount-подход). Активна в диапазоне
        // [DiscountStartDate; DiscountValidUntil] включительно (checklist-discount-fix.txt) —
        // сама включается и сама перестаёт применяться по датам, снимать вручную не нужно.
        // Все три поля обязаны быть заданы или не заданы вместе (TourValidationService);
        // DiscountStartDate == null у старых строк (до миграции AddTourDiscountStartDate)
        // трактуется как «нижней границы нет». Резолв активности — TourDiscountExtensions.
        public decimal? DiscountPercent { get; set; }
        public DateOnly? DiscountStartDate { get; set; }
        public DateOnly? DiscountValidUntil { get; set; }
        public string MainImageUrl { get; set; }
        public HashSet<TourDetail> TourDetails { get; set; } = [];
        public HashSet<TourInfoTranslation> Translations { get; set; } = [];
        public HashSet<AdditionalExpense> AdditionalExpenses { get; set; } = [];
        // Орг. детали и ограничения слиты в одну коллекцию, различаются по TourNote.Type (ADR 003).
        public HashSet<TourNote> Notes { get; set; } = [];
        public HashSet<TourRegion> TourRegions { get; set; } = [];
        // Мерч-теги (до 3, максимум 1 Discount) — TourValidationService.
        public HashSet<TourTag> TourTags { get; set; } = [];
        // Предопределённые времена начала (батч 2026-08-29): минимум одно у тура/экскурсии,
        // пусто у трансфера — там время подачи вводит клиент при бронировании.
        public HashSet<TourStartTime> StartTimes { get; set; } = [];
        // Только для TourType.Transfer: маршрут «откуда / стопы / куда» и цены по классам
        // авто. У тура и экскурсии обе коллекции пустые.
        public HashSet<TransferRoutePoint> TransferRoutePoints { get; set; } = [];
        public HashSet<TransferPrice> TransferPrices { get; set; } = [];
    }
}
