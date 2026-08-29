using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Общая валидация продукта для сценариев создания и обновления:
    // Excursion — ровно один день, многодневный Tour — минимум два дня.
    // Базовый класс — context-dependent (не EntityValidationBase<Tour>), потому что
    // проверка существования RegionId требует БД.
    //
    // Батч 2026-08-29: у продукта три типа, и трансфер валидируется по СВОЕМУ набору правил,
    // а не по «турным с исключениями» — из «богатства» тура у него остаётся только главная
    // картинка (решение 0.4). Поэтому ветка одна на весь продукт: либо тур/экскурсия, либо
    // трансфер, без пересечения проверок.
    internal class TourValidationService : EntityValidationContextDependentBase<Tour, ATToursContextFactory>
    {
        // «Максимум 3 тега на карточке» (мокап тегов) — ограничение бизнес-правила, не UI.
        private const int MaxTagsPerTour = 3;

        public TourValidationService(List<Tour> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                // Общее для всех трёх типов продукта: без русского названия карточку нечем
                // подписать ни на сайте, ни в админке.
                ValidateTitle(entity);

                if (entity.Type == TourType.Transfer)
                {
                    await ValidateTransferAsync(entity);
                    continue;
                }

                ValidateMainImage(entity);
                ValidateFormat(entity);
                ValidateStartTimes(entity);
                ValidateTransferOnlyCollectionsAreEmpty(entity);
                ValidateTourDaysByType(entity);
                ValidateDays(entity);
                await ValidateRegionsAsync(entity);
                await ValidatePlaceReferencesAsync(entity);
                await ValidateExpenseTemplateReferencesAsync(entity);
                await ValidateTourNoteTemplateReferencesAsync(entity);
                await ValidateTagsAsync(entity);
                ValidateDiscount(entity);
            }
        }

        // Аудит паритета фронт/бэк (решение 0.29): форма продукта не даёт сохранить продукт
        // без русского названия (validation.ts -> titleRu), но до сих пор это правило жило
        // ТОЛЬКО на фронте — прямой POST в API проходил. Русский обязателен, английский нет:
        // ровно та же асимметрия, что и во всей форме (EN везде необязателен).
        private static void ValidateTitle(Tour tour)
        {
            if (!HasRussianValue(tour.Translations, TourTranslationType.Title))
                throw new ErrorModelException(GlobalErrorCode.RequiredFieldMissing, HttpStatusCode.BadRequest,
                    "Product title in Russian is required.");
        }

        // Главная картинка обязательна у всех трёх типов продукта. У трансфера её проверяет
        // ValidateTransferAsync своим кодом (TransferMainImageRequired) — там это часть
        // «из богатства тура остаётся только картинка», здесь то же требование для тура и
        // экскурсии (validation.ts -> mainImageUrl).
        private static void ValidateMainImage(Tour tour)
        {
            if (string.IsNullOrWhiteSpace(tour.MainImageUrl))
                throw new ErrorModelException(GlobalErrorCode.RequiredFieldMissing, HttpStatusCode.BadRequest,
                    "Product main image is required.");
        }

        private static bool HasRussianValue(IEnumerable<TourInfoTranslation> translations, TourTranslationType type)
            => translations is not null
               && translations.Any(translation => translation.Type == type
                                                  && translation.LanguageCode == LanguageCode.Russian
                                                  && !string.IsNullOrWhiteSpace(translation.Value));

        // Формат тура/экскурсии (решение 0.16): обязателен всегда. Групповые поля осмыслены
        // только при Group/Both — при Individual они обязаны быть пустыми, иначе в БД осела бы
        // цена за человека, которая нигде не применяется (и всплыла бы при смене формата).
        private static void ValidateFormat(Tour tour)
        {
            if (tour.Format is null)
                throw new ErrorModelException(GlobalErrorCode.InvalidTourFormat, HttpStatusCode.BadRequest,
                    "Tour format is required for tours and excursions.");

            var isGroup = tour.Format is TourFormat.Group or TourFormat.Both;
            if (isGroup)
            {
                if (tour.GroupPricePerPerson is null or <= 0 || tour.GroupCapacity is null or <= 0)
                    throw new ErrorModelException(GlobalErrorCode.InvalidGroupPricing, HttpStatusCode.BadRequest,
                        "Group format requires a positive price per person and a positive capacity.");
            }
            else if (tour.GroupPricePerPerson is not null || tour.GroupCapacity is not null)
            {
                throw new ErrorModelException(GlobalErrorCode.InvalidGroupPricing, HttpStatusCode.BadRequest,
                    "Group price per person and group capacity are only allowed for the group format.");
            }
        }

        // Минимум одно время начала (решение 0.21): клиент выбирает слот из этого списка и
        // своего ввести не может, поэтому продукт без слотов невозможно забронировать.
        // Дубль времени — ошибка ввода, а не два слота: остаток мест группового формата
        // считается по паре (дата + время), дубль расщепил бы одну квоту на две.
        private static void ValidateStartTimes(Tour tour)
        {
            if (tour.StartTimes is null || tour.StartTimes.Count == 0)
                throw new ErrorModelException(GlobalErrorCode.InvalidTourStartTimes, HttpStatusCode.BadRequest,
                    "Tour must have at least one start time.");

            var duplicate = tour.StartTimes.GroupBy(startTime => startTime.Time).FirstOrDefault(group => group.Count() > 1);
            if (duplicate is not null)
                throw new ErrorModelException(GlobalErrorCode.InvalidTourStartTimes, HttpStatusCode.BadRequest,
                    $"Start time {duplicate.Key:HH\\:mm} is duplicated.");
        }

        // Зеркало запретов трансфера: маршрут и цены по классам авто существуют только у
        // TourType.Transfer. Пришли на туре/экскурсии — это рассинхрон формы, а не «просто
        // лишние данные»: они бы молча сохранились и всплыли при публичном чтении.
        private static void ValidateTransferOnlyCollectionsAreEmpty(Tour tour)
        {
            if (tour.TransferRoutePoints?.Count > 0 || tour.TransferPrices?.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    "Transfer route points and transfer prices are only allowed for transfers.");
        }

        // Трансфер (решение 0.4): из тура у него есть только главная картинка, маршрут,
        // цены по классам авто и участие в «Избранном». Всё остальное запрещено, а не
        // «необязательно» — иначе форма продукта могла бы записать в трансфер дни или
        // скидку, которые публичная страница трансфера всё равно не показывает.
        private async Task ValidateTransferAsync(Tour transfer)
        {
            if (transfer.Format is not null || transfer.GroupPricePerPerson is not null || transfer.GroupCapacity is not null)
                throw new ErrorModelException(GlobalErrorCode.InvalidTourFormat, HttpStatusCode.BadRequest,
                    "Transfer must not have a format or group pricing: its price is defined by the vehicle class.");

            if (string.IsNullOrWhiteSpace(transfer.MainImageUrl))
                throw new ErrorModelException(GlobalErrorCode.TransferMainImageRequired, HttpStatusCode.BadRequest,
                    "Transfer requires a main image.");

            // Галерея живёт на дне тура — запрет дней закрывает и её.
            if (transfer.TourDetails?.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.TransferFieldNotAllowed, HttpStatusCode.BadRequest,
                    "Transfer must not have tour days.");

            if (transfer.TourRegions?.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.TransferFieldNotAllowed, HttpStatusCode.BadRequest,
                    "Transfer must not have regions.");

            if (transfer.TourTags?.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.TransferFieldNotAllowed, HttpStatusCode.BadRequest,
                    "Transfer must not have tags.");

            if (transfer.Notes?.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.TransferFieldNotAllowed, HttpStatusCode.BadRequest,
                    "Transfer must not have organizational details or restrictions.");

            if (transfer.AdditionalExpenses?.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.TransferFieldNotAllowed, HttpStatusCode.BadRequest,
                    "Transfer must not have additional expenses.");

            if (transfer.DiscountPercent is not null || transfer.DiscountStartDate is not null || transfer.DiscountValidUntil is not null)
                throw new ErrorModelException(GlobalErrorCode.TransferFieldNotAllowed, HttpStatusCode.BadRequest,
                    "Transfer must not have a discount.");

            // Время подачи трансфера вводит сам клиент при бронировании (решение 0.9),
            // предопределённых слотов у трансфера не бывает.
            if (transfer.StartTimes?.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.InvalidTourStartTimes, HttpStatusCode.BadRequest,
                    "Transfer must not have predefined start times.");

            ValidateTransferRoute(transfer);
            await ValidateTransferPricesAsync(transfer);
        }

        // Маршрут: ровно одна точка «откуда» и ровно одна «куда», между ними сколько угодно
        // стопов. Текст точки свободный (подсказки из каталога Place — только на фронте,
        // решение 0.8), но пустым он быть не может: это и есть содержание трансфера.
        private static void ValidateTransferRoute(Tour transfer)
        {
            var routePoints = transfer.TransferRoutePoints ?? [];

            var fromCount = routePoints.Count(point => point.Kind == TransferRoutePointKind.From);
            var toCount = routePoints.Count(point => point.Kind == TransferRoutePointKind.To);

            if (fromCount != 1 || toCount != 1)
                throw new ErrorModelException(GlobalErrorCode.InvalidTransferRoute, HttpStatusCode.BadRequest,
                    "Transfer route must have exactly one 'from' point and exactly one 'to' point.");

            // Русский обязателен у каждой точки, включая промежуточные стопы (решение 0.29,
            // зеркало validation.ts -> transferFrom/transferTo/transferStopErrors). Прежнее
            // «хотя бы на одном языке» было слабее фронта: точка только с EN-подписью прошла
            // бы бэк, а публичная страница показывает маршрут по-русски по умолчанию.
            foreach (var point in routePoints)
            {
                var hasText = point.Translations is not null
                              && point.Translations.Any(translation => translation.LanguageCode == LanguageCode.Russian
                                                                       && !string.IsNullOrWhiteSpace(translation.Value));
                if (!hasText)
                    throw new ErrorModelException(GlobalErrorCode.InvalidTransferRoute, HttpStatusCode.BadRequest,
                        "Every transfer route point must have a name in Russian.");
            }
        }

        // Цены: минимум один класс авто, обе цены строго положительные (цена «туда-обратно» —
        // отдельное число, а не OneWay x 2, решение 0.6), без повторов класса и только на
        // существующие классы справочника — иначе SQL отдал бы невнятное FK-нарушение.
        private async Task ValidateTransferPricesAsync(Tour transfer)
        {
            var prices = transfer.TransferPrices ?? [];

            if (prices.Count == 0)
                throw new ErrorModelException(GlobalErrorCode.InvalidTransferPrices, HttpStatusCode.BadRequest,
                    "Transfer must have at least one vehicle class with prices.");

            if (prices.Any(price => price.OneWayPrice <= 0 || price.RoundTripPrice <= 0))
                throw new ErrorModelException(GlobalErrorCode.InvalidTransferPrices, HttpStatusCode.BadRequest,
                    "Transfer one-way and round-trip prices must be greater than zero.");

            var vehicleClassIds = prices.Select(price => price.VehicleClassId).ToList();

            var duplicate = vehicleClassIds.GroupBy(id => id).FirstOrDefault(group => group.Count() > 1);
            if (duplicate is not null)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    $"Vehicle class with id {duplicate.Key} is duplicated in the transfer's prices!");

            var existingCount = await Context.Set<VehicleClass>().CountAsync(vehicleClass => vehicleClassIds.Contains(vehicleClass.Id));
            if (existingCount != vehicleClassIds.Count)
                throw new ErrorModelException(GlobalErrorCode.VehicleClassNotFound, HttpStatusCode.BadRequest,
                    "One or more vehicle classes do not exist.");
        }

        // Скидка тура (Фаза 3, диапазон дат — checklist-discount-fix.txt): процент и обе границы
        // задаются вместе или не задаются вовсе. "Процент без дат" нарушил бы правило ADR
        // "скидка сама снимается по дате", а дата начала без даты окончания дала бы вечную акцию.
        private static void ValidateDiscount(Tour tour)
        {
            if (tour.DiscountPercent is null && tour.DiscountStartDate is null && tour.DiscountValidUntil is null)
                return;

            if (tour.DiscountPercent is null || tour.DiscountStartDate is null || tour.DiscountValidUntil is null)
                throw new ErrorModelException(GlobalErrorCode.InvalidTourDiscount, HttpStatusCode.BadRequest,
                    "Tour discount requires a percent value together with both start and valid-until dates.");

            if (tour.DiscountPercent <= 0 || tour.DiscountPercent > 100)
                throw new ErrorModelException(GlobalErrorCode.InvalidTourDiscount, HttpStatusCode.BadRequest,
                    "Tour discount percent must be between 0 and 100.");

            // Диапазон включительный с обеих сторон, поэтому акция на один день (start == end) — ОК.
            if (tour.DiscountStartDate > tour.DiscountValidUntil)
                throw new ErrorModelException(GlobalErrorCode.InvalidTourDiscount, HttpStatusCode.BadRequest,
                    "Tour discount start date cannot be later than the valid-until date.");
        }

        private void ValidateTourDaysByType(Tour tour)
        {
            if (tour.TourDetails is null || tour.TourDetails.IsEmpty())
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Tour details mismatch!");
            if (tour.Type == Common.Enums.TourType.Excursion)
            {
                if (tour.TourDetails.Count != 1)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Excursion tour must have exactly one tour day!");
            }
            else if (tour.Type == Common.Enums.TourType.Tour)
            {
                if (tour.TourDetails.Count < 2)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Multi-day tour must have at least two tour days!");
            }
        }

        // Правила уровня дня: цена не может быть отрицательной, и в каждом дне
        // (в т.ч. в единственном дне экскурсии) обязана быть хотя бы одна точка маршрута.
        private void ValidateDays(Tour tour)
        {
            foreach (var detail in tour.TourDetails)
            {
                var day = detail.TourDay;
                if (day is null)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Tour day is missing!");

                if (day.Price < 0)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Tour day price cannot be negative!");

                // Русское название дня обязательно у многодневного тура (решение 0.29,
                // зеркало validation.ts -> dayTitleErrors). Единственный день экскурсии
                // наследует тексты самого продукта и своего названия не имеет — форма его
                // не показывает и не валидирует, бэк тоже не должен.
                if (tour.Type == TourType.Tour && !HasRussianDayTitle(day))
                    throw new ErrorModelException(GlobalErrorCode.RequiredFieldMissing, HttpStatusCode.BadRequest,
                        "Tour day title in Russian is required.");

                if (day.RoutePoints is null || day.RoutePoints.IsEmpty())
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Each tour day must have at least one route point!");
            }
        }

        private static bool HasRussianDayTitle(TourDay day)
            => day.Translations is not null
               && day.Translations.Any(translation => translation.Type == TourDayTranslationType.Title
                                                      && translation.LanguageCode == LanguageCode.Russian
                                                      && !string.IsNullOrWhiteSpace(translation.Value));

        // Регион у тура необязателен (решение Давида D-2). Если регионы всё же переданы:
        // RegionId не должны повторяться, и все они должны существовать в БД.
        private async Task ValidateRegionsAsync(Tour tour)
        {
            if (tour.TourRegions is null || tour.TourRegions.Count == 0)
                return;

            var regionIds = tour.TourRegions.Select(tr => tr.RegionId).ToList();

            var duplicate = regionIds.GroupBy(id => id).FirstOrDefault(group => group.Count() > 1);
            if (duplicate is not null)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    $"Region with id {duplicate.Key} is duplicated in the tour's regions!");

            var existingCount = await Context.Set<Region>().CountAsync(region => regionIds.Contains(region.Id));
            if (existingCount != regionIds.Count)
                throw new ErrorModelException(GlobalErrorCode.RegionNotFound, HttpStatusCode.BadRequest, "One or more regions do not exist.");
        }

        // Каталог Place (3.4): каждая точка с PlaceId != null должна ссылаться на существующую
        // точку каталога. Иначе SQL отдал бы невнятное FK-нарушение вместо 400 PlaceNotFound.
        private async Task ValidatePlaceReferencesAsync(Tour tour)
        {
            if (tour.TourDetails is null)
                return;

            var placeIds = tour.TourDetails
                               .Where(detail => detail.TourDay?.RoutePoints is not null)
                               .SelectMany(detail => detail.TourDay.RoutePoints)
                               .Where(routePoint => routePoint.PlaceId.HasValue)
                               .Select(routePoint => routePoint.PlaceId.GetValueOrDefault())
                               .Distinct()
                               .ToList();

            if (placeIds.Count == 0)
                return;

            var existingCount = await Context.Set<Place>().CountAsync(place => placeIds.Contains(place.Id));
            if (existingCount != placeIds.Count)
                throw new ErrorModelException(GlobalErrorCode.PlaceNotFound, HttpStatusCode.BadRequest, "One or more places do not exist.");
        }

        // Каталог ExpenseTemplate (3.4): каждый расход с ExpenseTemplateId != null должен
        // ссылаться на существующий шаблон.
        private async Task ValidateExpenseTemplateReferencesAsync(Tour tour)
        {
            if (tour.AdditionalExpenses is null)
                return;

            var templateIds = tour.AdditionalExpenses
                                  .Where(expense => expense.ExpenseTemplateId.HasValue)
                                  .Select(expense => expense.ExpenseTemplateId.GetValueOrDefault())
                                  .Distinct()
                                  .ToList();

            if (templateIds.Count == 0)
                return;

            var existingCount = await Context.Set<ExpenseTemplate>().CountAsync(template => templateIds.Contains(template.Id));
            if (existingCount != templateIds.Count)
                throw new ErrorModelException(GlobalErrorCode.ExpenseTemplateNotFound, HttpStatusCode.BadRequest, "One or more expense templates do not exist.");
        }

        // Каталог TourNoteTemplate (3.4): каждая заметка с TourNoteTemplateId != null должна
        // ссылаться на существующий шаблон И совпадать с ним по Type (нельзя привязать
        // орг.деталь к шаблону-ограничению).
        private async Task ValidateTourNoteTemplateReferencesAsync(Tour tour)
        {
            if (tour.Notes is null)
                return;

            var referencingNotes = tour.Notes
                                       .Where(note => note.TourNoteTemplateId.HasValue)
                                       .ToList();

            if (referencingNotes.Count == 0)
                return;

            var templateIds = referencingNotes.Select(note => note.TourNoteTemplateId.GetValueOrDefault()).Distinct().ToList();

            var templateTypeById = await Context.Set<TourNoteTemplate>()
                                                .Where(template => templateIds.Contains(template.Id))
                                                .Select(template => new { template.Id, template.Type })
                                                .ToListAsync();

            var typeById = templateTypeById.ToDictionary(template => template.Id, template => template.Type);

            foreach (var note in referencingNotes)
            {
                var templateId = note.TourNoteTemplateId.GetValueOrDefault();
                if (!typeById.TryGetValue(templateId, out var templateType))
                    throw new ErrorModelException(GlobalErrorCode.TourNoteTemplateNotFound, HttpStatusCode.BadRequest,
                        $"Tour note template with id {templateId} does not exist.");

                if (note.Type != templateType)
                    throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                        $"Tour note type {(int)note.Type} does not match template type {(int)templateType}.");
            }
        }

        // Каталог Tag: не больше MaxTagsPerTour штук, без дублей TagId, все TagId должны существовать.
        private async Task ValidateTagsAsync(Tour tour)
        {
            if (tour.TourTags is null || tour.TourTags.Count == 0)
                return;

            var tagIds = tour.TourTags.Select(tt => tt.TagId).ToList();

            var duplicate = tagIds.GroupBy(id => id).FirstOrDefault(group => group.Count() > 1);
            if (duplicate is not null)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                    $"Tag with id {duplicate.Key} is duplicated in the tour's tags!");

            if (tagIds.Count > MaxTagsPerTour)
                throw new ErrorModelException(GlobalErrorCode.TooManyTags, HttpStatusCode.BadRequest,
                    $"A tour can have at most {MaxTagsPerTour} tags.");

            var existingCount = await Context.Set<Tag>()
                                    .Where(tag => tagIds.Contains(tag.Id))
                                    .CountAsync();

            if (existingCount != tagIds.Count)
                throw new ErrorModelException(GlobalErrorCode.TagNotFound, HttpStatusCode.BadRequest, "One or more tags do not exist.");
        }
    }
}
