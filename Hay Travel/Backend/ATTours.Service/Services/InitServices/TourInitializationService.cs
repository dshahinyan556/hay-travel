using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Init;
using ATTours.Common.Enums;

namespace ATTours.BusinessServices.Services.InitServices
{
    public class TourInitializationService(TourType tourType) : IInitializationService<TourCreateModel>
    {
        public async Task<TourCreateModel> InitAsync()
        {
            var initModel = new TourCreateModel()
            {
                Type = tourType,
                Translations = InitTranslations<TourTranslationType>(),
                TourDays = InitTourDays(),
                Notes = new List<TourNoteCreateModel>(),
                Regions = new List<TourRegionCreateModel>()
            };

            return await Task.FromResult(initModel);
        }

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

        private List<TourDayCreateModel> InitTourDays()
        {
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
