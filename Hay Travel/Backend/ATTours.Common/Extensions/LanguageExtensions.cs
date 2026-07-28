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
            foreach (var organizationalDetail in tour.OrganizationalDetails)
                organizationalDetail.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
            foreach (var restriction in tour.Restrictions)
                restriction.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);

            return tour;
        }

        public static List<Tour> ExtractWithNeededLanguageFromCollection(this IEnumerable<Tour> tours, int languageCode)
        {
            var returnList = new List<Tour>();
            foreach (var tour in tours)
                returnList.Add(tour.ExtractWithNeededLanguage(languageCode));
            return returnList;
        }
    }
}
