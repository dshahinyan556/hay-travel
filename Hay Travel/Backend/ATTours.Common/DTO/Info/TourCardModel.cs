using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Облегчённая проекция тура для публичного списка карточек (пункт 3.5, D-11).
    // Несёт ТОЛЬКО то, что рисует карточка на клиентском сайте (см. shared/ui/TourCard.tsx):
    // тип (тур/экскурсия — чип + расчёт ночей), название и краткое описание (в переводах,
    // одна локаль, различаются по Type), цена «от», главное фото, длительность в днях и
    // регионы (слаги). По-дневной граф/точки/расходы/заметки в карточку НЕ грузятся — поэтому
    // резолв каталожных override на списке не нужен (он только в детальной GetTourInfo).
    //
    // Slug у карточки НЕТ: сущность Tour не имеет поля Slug (добавление потребовало бы миграции,
    // вне скоупа 3.5), а публичная детальная адресуется по id (GET GetTourInfo?id=). Рейтинг/
    // отзывы/УТП-бейджи карточки — фронтовые моки, в доменной модели бэка их нет, не выдумываем.
    public class TourCardModel
    {
        public int Id { get; set; }
        public TourType Type { get; set; }
        // Бейдж формата на карточке (решение 0.16). null у трансфера — карточка трансфера
        // в общий каталог не попадает, но в «Избранном» на главной трансферы есть.
        public TourFormat? Format { get; set; }
        // Групповой формат: цена за человека — то, что карточка показывает вместо TotalPrice
        // (без тирной наценки). null у индивидуального формата.
        public decimal? GroupPricePerPerson { get; set; }
        public decimal? TotalPrice { get; set; }
        // Резолвнутая цена со скидкой (Фаза 3) — null, если активной скидки нет.
        // TotalPrice остаётся «старой» ценой для зачёркнутого отображения.
        public decimal? DiscountedPrice { get; set; }
        // Границы акции — только для отображения ("с ДД.ММ" / "действует до ДД.ММ") рядом
        // с DiscountedPrice. Обе приходят непустыми только когда скидка реально активна
        // сегодня, иначе null (MappingProfile) — карточка не должна анонсировать будущую акцию.
        public DateOnly? DiscountStartDate { get; set; }
        public DateOnly? DiscountValidUntil { get; set; }
        public string MainImageUrl { get; set; }
        // Число дней тура = количество TourDetails. Число ночей выводимо на фронте
        // (экскурсия = 0, тур = дни − 1) и в БД не хранится — отдельным полем не дублируем.
        public int DurationDays { get; set; }
        // Тур-уровневые переводы одной локали: Title и ShortDescription различаются по Type
        // (как в TourInfoModel). Description/Duration тоже приходят, но это тур-уровень — дёшево.
        public List<TranslatableInfoModel> Translations { get; set; }
        // Плоские слаги регионов (как в TourInfoModel.Regions) → фронтовый regionSlugs.
        public List<TourRegionInfoModel> Regions { get; set; }
        // Плоская проекция (как Regions) — имя/цвет/тип/процент тега фронт получает одним
        // запросом к TagController.GetForClient, не из каждой карточки.
        public List<TourTagInfoModel> Tags { get; set; }
    }
}
