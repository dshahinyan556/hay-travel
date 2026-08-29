using ATTours.Common.Entities;

namespace ATTours.Common.Extensions
{
    public static class LanguageExtensions
    {
        public static Tour ExtractWithNeededLanguage(this Tour tour, int languageCode)
        {
            tour.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            foreach (var tourDetail in tour.TourDetails)
            {
                tourDetail.TourDay.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
                foreach (var routePoint in tourDetail.TourDay.RoutePoints)
                    routePoint.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            }
            foreach (var additionalExpense in tour.AdditionalExpenses)
                additionalExpense.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            // Орг. детали и ограничения — один список Notes, различаются по Type (ADR 003).
            foreach (var note in tour.Notes)
                note.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);

            return tour;
        }

        public static List<Tour> ExtractWithNeededLanguageFromCollection(this IEnumerable<Tour> tours, int languageCode)
        {
            var returnList = new List<Tour>();
            foreach (var tour in tours)
                returnList.Add(tour.ExtractWithNeededLanguage(languageCode));
            return returnList;
        }

        // Переводы региона в граф тура не включаются (TourRegionInfoModel — плоская
        // проекция), поэтому тут фильтруется только собственный список переводов региона.
        public static Region ExtractWithNeededLanguage(this Region region, int languageCode)
        {
            region.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            return region;
        }

        public static List<Region> ExtractWithNeededLanguageFromCollection(this IEnumerable<Region> regions, int languageCode)
        {
            var returnList = new List<Region>();
            foreach (var region in regions)
                returnList.Add(region.ExtractWithNeededLanguage(languageCode));
            return returnList;
        }

        // Каталоги-справочники (3.4): GetForClient оставляет одну локаль. Резолв override
        // «own ?? template» тут не выполняется — это отдельный публичный путь чтения тура (3.5).
        public static Place ExtractWithNeededLanguage(this Place place, int languageCode)
        {
            place.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            return place;
        }

        public static List<Place> ExtractWithNeededLanguageFromCollection(this IEnumerable<Place> places, int languageCode)
        {
            var returnList = new List<Place>();
            foreach (var place in places)
                returnList.Add(place.ExtractWithNeededLanguage(languageCode));
            return returnList;
        }

        public static ExpenseTemplate ExtractWithNeededLanguage(this ExpenseTemplate template, int languageCode)
        {
            template.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            return template;
        }

        public static List<ExpenseTemplate> ExtractWithNeededLanguageFromCollection(this IEnumerable<ExpenseTemplate> templates, int languageCode)
        {
            var returnList = new List<ExpenseTemplate>();
            foreach (var template in templates)
                returnList.Add(template.ExtractWithNeededLanguage(languageCode));
            return returnList;
        }

        public static TourNoteTemplate ExtractWithNeededLanguage(this TourNoteTemplate template, int languageCode)
        {
            template.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            return template;
        }

        public static List<TourNoteTemplate> ExtractWithNeededLanguageFromCollection(this IEnumerable<TourNoteTemplate> templates, int languageCode)
        {
            var returnList = new List<TourNoteTemplate>();
            foreach (var template in templates)
                returnList.Add(template.ExtractWithNeededLanguage(languageCode));
            return returnList;
        }

        // Трансфер (батч 2026-08-29): у него СВОЙ граф — маршрут и цены по классам авто
        // вместо дней/расходов/заметок, поэтому отдельный метод, а не ветка внутри
        // ExtractWithNeededLanguage(Tour): та обходит TourDetails, которых в трансферном
        // графе нет, и всё равно не знает про TransferRoutePoints.
        // VehicleClass может быть не загружен (card-граф его не тянет) — тогда его переводы
        // фильтровать нечего.
        public static Tour ExtractTransferWithNeededLanguage(this Tour transfer, int languageCode)
        {
            transfer.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);

            foreach (var routePoint in transfer.TransferRoutePoints)
                routePoint.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);

            foreach (var price in transfer.TransferPrices)
                price.VehicleClass?.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);

            return transfer;
        }

        public static List<Tour> ExtractTransfersWithNeededLanguageFromCollection(this IEnumerable<Tour> transfers, int languageCode)
        {
            var returnList = new List<Tour>();
            foreach (var transfer in transfers)
                returnList.Add(transfer.ExtractTransferWithNeededLanguage(languageCode));
            return returnList;
        }

        public static VehicleClass ExtractWithNeededLanguage(this VehicleClass vehicleClass, int languageCode)
        {
            vehicleClass.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            return vehicleClass;
        }

        public static List<VehicleClass> ExtractWithNeededLanguageFromCollection(this IEnumerable<VehicleClass> vehicleClasses, int languageCode)
        {
            var returnList = new List<VehicleClass>();
            foreach (var vehicleClass in vehicleClasses)
                returnList.Add(vehicleClass.ExtractWithNeededLanguage(languageCode));
            return returnList;
        }

        public static Tag ExtractWithNeededLanguage(this Tag tag, int languageCode)
        {
            tag.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            return tag;
        }

        public static List<Tag> ExtractWithNeededLanguageFromCollection(this IEnumerable<Tag> tags, int languageCode)
        {
            var returnList = new List<Tag>();
            foreach (var tag in tags)
                returnList.Add(tag.ExtractWithNeededLanguage(languageCode));
            return returnList;
        }
    }
}
