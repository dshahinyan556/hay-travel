using ATTours.Common.Enums;

namespace ATTours.Common.Extensions
{
    // Подписи ролей нужны бэкенду ровно для двух вещей — подстановки в письмо
    // ({{EmployeeRole}}, теперь билингвально) и печати в PDF (там всегда русский).
    // В API подписи не уходят: фронт мапит числа сам.
    public static class EmployeeJobRoleExtensions
    {
        public static string ToLabel(this EmployeeJobRole role, LanguageCode language)
        {
            if (language == LanguageCode.English)
                return role switch
                {
                    EmployeeJobRole.Driver => "Driver",
                    EmployeeJobRole.Guide => "Guide",
                    EmployeeJobRole.DriverGuide => "Driver-guide",
                    // Значение вне enum не должно выглядеть как идентификатор.
                    _ => string.Empty
                };

            return role switch
            {
                EmployeeJobRole.Driver => "Водитель",
                EmployeeJobRole.Guide => "Гид",
                EmployeeJobRole.DriverGuide => "Гид-водитель",
                _ => string.Empty
            };
        }

        // PDF остаётся русским (локализация документа вне скоупа), поэтому отдельный
        // короткий вызов сохранён — но реализован через общий ToLabel, чтобы подписи
        // не разъезжались между письмом и документом.
        public static string ToRussianLabel(this EmployeeJobRole role)
            => role.ToLabel(LanguageCode.Russian);
    }
}
