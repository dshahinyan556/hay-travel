namespace ATTours.Common.DTO.Request
{
    // Правка параметров задачи с её собственного экрана: ключ настройки -> новое значение
    // строкой (как их и хранит SiteSetting). Частичная — прислать можно только те ключи,
    // что реально менялись.
    //
    // Ключ обязан принадлежать именно этой задаче (BackgroundJobDefinition.ParameterKeys),
    // иначе экран задачи стал бы универсальным редактором настроек сайта в обход права
    // settings:Update.
    public class UpdateJobParametersModel
    {
        public Dictionary<string, string> Values { get; set; }
    }
}
