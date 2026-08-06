using ATTours.Common.Entities;

namespace ATTours.BusinessServices.Services
{
    // B11 (2026-08-06): при добавлении НОВОЙ точки маршрута (Id == default) с PlaceId — её
    // фото по умолчанию копируются в галерею дня (TourDay.GalleryImages), где эта точка стоит.
    // Существующие точки не трогаем (буквальное требование пункта), даже если их PlaceId
    // меняется. Общая логика между TourCreationService (Create — весь граф новый) и
    // TourUpdateService (Update — только реально новые точки) — вынесена сюда, а не в generic
    // ReconcileCollection<T> (это протекло бы Tour/Place-специфичной бизнес-логикой в чисто
    // структурный diff-хелпер, см. чек-лист B11).
    public static class RoutePointGalleryImageCopier
    {
        // Копирует фото каждой новой точки в галерею дня: одна GalleryImage на каждый
        // Place.Images (по SortOrder), а если у Place Images пуст — fallback на одну
        // GalleryImage из Place.ImageUrl (B10 backward-compat для Place без строк PlaceImage).
        // SortOrder продолжает существующий максимум дня. Не дедуплицируется: одна и та же
        // Place на двух точках маршрута — фото попадут в галерею дважды (осознанно, B11).
        public static void AppendImagesForNewRoutePoints(TourDay day, IEnumerable<RoutePoint> newRoutePoints, IReadOnlyDictionary<int, Place> placesById)
        {
            var nextSortOrder = day.GalleryImages.Count == 0 ? 0 : day.GalleryImages.Max(gi => gi.SortOrder) + 1;

            foreach (var routePoint in newRoutePoints)
            {
                if (!routePoint.PlaceId.HasValue || !placesById.TryGetValue(routePoint.PlaceId.Value, out var place))
                    continue;

                if (place.Images.Count > 0)
                {
                    foreach (var image in place.Images.OrderBy(i => i.SortOrder))
                    {
                        day.GalleryImages.Add(new GalleryImage { Url = image.Url, SortOrder = nextSortOrder });
                        nextSortOrder++;
                    }
                }
                else if (!string.IsNullOrWhiteSpace(place.ImageUrl))
                {
                    day.GalleryImages.Add(new GalleryImage { Url = place.ImageUrl, SortOrder = nextSortOrder });
                    nextSortOrder++;
                }
            }
        }
    }
}
