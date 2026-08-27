using ATTours.BusinessServices.Files;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.Authorization;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace ATTours.ClientAPI.Controllers
{
    // Загрузка изображений (ADR 2026-08-15) — второй способ заполнить те же ImageUrl-строковые
    // поля, что раньше принимали только ручной URL (тур, точки маршрута, настройки сайта).
    //
    // Кросс-скрин утилита: собственного ключа прав у неё нет, доступ производен от права
    // редактировать контент, в который картинка вставляется (architecture-flexible-roles.md
    // §2.5). Тур-менеджер сохраняет доступ через products.Update, как и раньше.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UploadController : Controller
    {
        [HttpPost]
        [Route("Image")]
        [RequiresAnyPermission(
            AdminScreens.Products + ":" + nameof(PermissionAction.Create),
            AdminScreens.Products + ":" + nameof(PermissionAction.Update),
            AdminScreens.CatalogPlaces + ":" + nameof(PermissionAction.Create),
            AdminScreens.CatalogPlaces + ":" + nameof(PermissionAction.Update),
            AdminScreens.Settings + ":" + nameof(PermissionAction.Update))]
        [RequestSizeLimit(10_000_000)]
        public async Task<ImageUploadResult> ImageAsync(IFormFile file, CancellationToken cancellationToken)
        {
            var settings = UploadSettings.Instance;
            if (file.Length > settings.MaxFileSizeBytes)
                throw new ErrorModelException(
                    GlobalErrorCode.UploadFileTooLarge,
                    HttpStatusCode.BadRequest,
                    $"File exceeds the maximum allowed size of {settings.MaxFileSizeBytes} bytes.");

            var service = new ImageUploadService(settings);
            await using var stream = file.OpenReadStream();
            return await service.SaveAsync(stream, file.ContentType, cancellationToken);
        }
    }
}
