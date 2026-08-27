using ATTours.ClientAPI.Authorization;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Enums;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Реестр экранов админки для редактора матрицы прав: строки таблицы на фронте — этот
    // список, колонки — только применимые к экрану действия. В БД не ходит: единственный
    // источник — AdminScreens.All (architecture-flexible-roles.md §4.2).
    //
    // Чисто вспомогательный эндпоинт редактора ролей — гейтится тем же ключом, что и сам
    // Roles (roles.View): кто не видит список ролей, тому и реестр экранов не нужен.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    [RequiresPermission(AdminScreens.Roles, PermissionAction.View)]
    public class ScreensController(IMapper mapper) : Controller
    {
        [HttpGet]
        public List<ScreenDefinitionModel> GetAll()
            => mapper.Map<List<ScreenDefinitionModel>>(AdminScreens.All);
    }
}
