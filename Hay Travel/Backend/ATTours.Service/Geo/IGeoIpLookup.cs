namespace ATTours.BusinessServices.Geo
{
    // Страна/город по IP. Всё, что относится к неизвестному адресу (приватный диапазон,
    // отсутствующая база, битый ввод), выражается одним значением — null: у вызывающих
    // (GeoController, AuthService) нет сценария, где различие между «базы нет» и
    // «адреса в базе нет» что-то меняет.
    public interface IGeoIpLookup
    {
        GeoLocation? Lookup(string? ipAddress);
    }

    // Отдельные поля могут быть null независимо друг от друга: у DB-IP City Lite город есть
    // не для каждого диапазона, страна — почти всегда.
    public record GeoLocation(string? CountryCode, string? CountryName, string? City);
}
