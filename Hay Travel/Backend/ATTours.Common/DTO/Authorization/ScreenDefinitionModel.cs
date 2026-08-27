using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Authorization
{
    // Строка реестра экранов для GET api/Screens — по ней фронт строит редактор матрицы
    // (строки = экраны, колонки = только применимые из V/C/U/D).
    public class ScreenDefinitionModel
    {
        public string Key { get; set; }
        public string DisplayName { get; set; }
        public List<PermissionAction> Actions { get; set; } = [];
    }
}
