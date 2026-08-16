using ATTours.BusinessServices.Files;
using ATTours.ClientAPI.Authorization;
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
    // TourManagerOrAdmin: та же граница доступа, что у Tour/Place Create/Update — тур-менеджер
    // должен иметь возможность загрузить фото прямо из формы тура/точки, не только Admin.
    [ApiController]
    [Route("api/[controller]")]
    public class UploadController : Controller
    {
        [HttpPost]
        [Route("Image")]
        [Authorize(Roles = ApiRoles.TourManagerOrAdmin)]
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
