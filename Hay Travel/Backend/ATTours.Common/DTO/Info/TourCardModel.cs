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
        public decimal? TotalPrice { get; set; }
        public string MainImageUrl { get; set; }
        // Число дней тура = количество TourDetails. Число ночей выводимо на фронте
        // (экскурсия = 0, тур = дни − 1) и в БД не хранится — отдельным полем не дублируем.
        public int DurationDays { get; set; }
        // Тур-уровневые переводы одной локали: Title и ShortDescription различаются по Type
        // (как в TourInfoModel). Description/Duration тоже приходят, но это тур-уровень — дёшево.
        public List<TranslatableInfoModel> Translations { get; set; }
        // Плоские слаги регионов (как в TourInfoModel.Regions) → фронтовый regionSlugs.
        public List<TourRegionInfoModel> Regions { get; set; }
    }
}
