using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.BusinessServices.Services.InitServices
{
    public class TourInitializationService(TourType tourType) : IInitializationService<TourCreateModel>
    {
        public async Task<TourCreateModel> InitAsync()
        {
            var isTransfer = tourType == TourType.Transfer;

            var initModel = new TourCreateModel()
            {
                Type = tourType,
                // Раньше предоплата показывалась на КАЖДОМ туре безусловно — новый тур
                // сохраняет это поведение, пока админ явно не отключит (B12, 2026-08-13).
                RequiresPrepayment = true,
                // Формат есть только у тура/экскурсии (решение 0.16). Individual = прежнее
                // поведение цены, поэтому это и дефолт нового продукта.
                Format = isTransfer ? null : TourFormat.Individual,
                Translations = InitTranslations<TourTranslationType>(),
                TourDays = InitTourDays(),
                Notes = new List<TourNoteCreateModel>(),
                Regions = new List<TourRegionCreateModel>(),
                // Минимум одно время старта обязательно (решение 0.21) — скелет отдаётся с
                // тем же 09:00, что миграция проставила существующим продуктам, чтобы форму
                // можно было сохранить, не заводя слот руками. У трансфера слотов не бывает.
                StartTimes = isTransfer
                    ? []
                    : [new TourStartTimeCreateModel { Time = new TimeOnly(9, 0), SortOrder = 0 }],
                // Скелет маршрута трансфера: «откуда» и «куда» обязательны и ровно по одному,
                // стопы админ добавляет сам (тот же принцип, что у скелета дней тура).
                TransferRoutePoints = isTransfer ? InitTransferRoutePoints() : [],
                TransferPrices = []
            };

            return await Task.FromResult(initModel);
        }

        private List<TransferRoutePointCreateModel> InitTransferRoutePoints() =>
        [
            new() { Kind = TransferRoutePointKind.From, SortOrder = 0, Translations = InitPlainTranslations() },
            new() { Kind = TransferRoutePointKind.To, SortOrder = 1, Translations = InitPlainTranslations() }
        ];

        // Точка маршрута трансфера — однополевой перевод без семантики Type (как
        // RoutePointTranslation), поэтому обычный InitTranslations<TEnum> тут не подходит.
        private List<TranslatableCreateModel> InitPlainTranslations() =>
        [
            new() { Type = 0, LanguageCode = LanguageCode.Russian },
            new() { Type = 0, LanguageCode = LanguageCode.English }
        ];

        private List<TranslatableCreateModel> InitTranslations<TType>(params TType[] exceptValues)
            where TType : Enum
        {
            var translationItems = new List<TranslatableCreateModel>();
            var enumValues = Enum.GetValues(typeof(TType)).Cast<TType>().Except(exceptValues); //TODO nayelu

            foreach (var enumValue in enumValues)
                translationItems.AddRange([InitSingleTranslation(enumValue, LanguageCode.Russian),
                                           InitSingleTranslation(enumValue, LanguageCode.English)]);

            return translationItems;
        }

        private TranslatableCreateModel InitSingleTranslation<TType>(TType type, LanguageCode language) where TType : Enum
            => new TranslatableCreateModel { Type = Convert.ToInt32(type), LanguageCode = language };

        // У трансфера дней нет вообще (решение 0.4) — не «один пустой», а ни одного:
        // непустая коллекция дней у трансфера отвергается TourValidationService.
        private List<TourDayCreateModel> InitTourDays()
        {
            if (tourType == TourType.Transfer)
                return [];

            var tourDays = new List<TourDayCreateModel>() { InitSingleTourDay() };
            if (tourType == TourType.Tour)
                tourDays.Add(InitSingleTourDay());
            return tourDays;
        }

        private TourDayCreateModel InitSingleTourDay() => new()
        {
            Translations = InitTranslations<TourDayTranslationType>(),
            RoutePoints = new List<RoutePointCreateModel>()
        };
    }
}
