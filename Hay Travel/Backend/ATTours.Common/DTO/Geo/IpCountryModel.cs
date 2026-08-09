namespace ATTours.Common.DTO.Geo
{
    // Ответ GET api/Geo/Country (B2, 2026-08-09): чем подсветить страну по умолчанию в
    // дропдауне телефона. Все поля могут прийти пустыми — база гео-IP необязательна, и
    // «не определилось» здесь нормальный, а не ошибочный исход.
    //
    // Телефонного кода страны (dialCode) тут намеренно нет: он живёт во фронте
    // (libphonenumber-js), дублировать его справочник на бэке незачем.
    public class IpCountryModel
    {
        public string CountryCode { get; set; }
        public string CountryName { get; set; }
        public string City { get; set; }
    }
}
