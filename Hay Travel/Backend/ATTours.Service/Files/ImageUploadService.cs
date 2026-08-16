using ATTours.Common.Settings;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using SkiaSharp;
using System.Net;

namespace ATTours.BusinessServices.Files
{
    public class ImageUploadResult
    {
        // URL относительный, начинается с UploadSettings.PublicUrlPrefix ("/uploads") — тот же
        // формат строки, что и раньше принимал ValueType.ImageUrl вручную. WebP-вариант всегда
        // существует рядом, тем же именем с расширением ".webp" (ImageUrlField / ImageListEditor
        // на фронте это допущение не используют — оно только для adaptive-показа на публичном сайте).
        public required string Url { get; init; }
    }

    // Локальное хранилище изображений (ADR 2026-08-15: URL остаётся альтернативой, это —
    // второй способ получить то же значение). Не абстрагирован интерфейсом: единственная
    // реализация, менять на что-то другое (S3 и т.п.) конфигом не планируется — тот же
    // принцип, что и у большинства *Info/*UpdateService в проекте (конструкторный new,
    // не DI), см. комментарий в PlaceController.
    public class ImageUploadService
    {
        private readonly UploadSettings settings;

        public ImageUploadService() : this(UploadSettings.Instance)
        {
        }

        public ImageUploadService(UploadSettings settings)
        {
            this.settings = settings;
        }

        // fileStream должен быть seek-able (controller передаёт IFormFile.OpenReadStream()).
        public async Task<ImageUploadResult> SaveAsync(Stream fileStream, string contentType, CancellationToken cancellationToken = default)
        {
            if (!settings.AllowedContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
                throw new ErrorModelException(GlobalErrorCode.UploadContentTypeNotAllowed, HttpStatusCode.BadRequest,
                    $"Content type '{contentType}' is not allowed.");

            using var codec = SKCodec.Create(fileStream)
                ?? throw new ErrorModelException(GlobalErrorCode.UploadInvalidImage, HttpStatusCode.BadRequest, "File is not a readable image.");

            var decoded = SKBitmap.Decode(codec)
                ?? throw new ErrorModelException(GlobalErrorCode.UploadInvalidImage, HttpStatusCode.BadRequest, "File is not a readable image.");

            // Телефонные фото почти всегда несут EXIF-ориентацию вместо повёрнутых пикселей —
            // без этого шага портретные снимки с iPhone/Android лягут на бок в галерее.
            using var oriented = ApplyExifOrientation(decoded, codec.EncodedOrigin);

            var extension = ExtensionFor(contentType);
            var baseName = Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            var relativeDir = $"{now:yyyy}/{now:MM}";
            var absoluteDir = Path.Combine(settings.StoragePath, now.ToString("yyyy"), now.ToString("MM"));
            Directory.CreateDirectory(absoluteDir);

            using (var original = ResizeToMaxDimension(oriented.Copy(), settings.MaxOriginalDimension))
            {
                var originalPath = Path.Combine(absoluteDir, $"{baseName}.{extension}");
                await using var originalFile = File.Create(originalPath);
                using var originalImage = SKImage.FromBitmap(original);
                using var originalData = originalImage.Encode(FormatFor(contentType), OriginalQualityFor(contentType));
                originalData.SaveTo(originalFile);
            }

            using (var compressed = ResizeToMaxDimension(oriented.Copy(), settings.CompressedMaxDimension))
            {
                var compressedPath = Path.Combine(absoluteDir, $"{baseName}.webp");
                await using var compressedFile = File.Create(compressedPath);
                using var compressedImage = SKImage.FromBitmap(compressed);
                using var compressedData = compressedImage.Encode(SKEncodedImageFormat.Webp, settings.WebpQuality);
                compressedData.SaveTo(compressedFile);
            }

            return new ImageUploadResult { Url = $"{UploadSettings.PublicUrlPrefix}/{relativeDir}/{baseName}.{extension}" };
        }

        // Возвращает НОВЫЙ битмап и высвобождает bitmap, переданный на вход, — вызывающий код
        // владеет только результатом (та же семантика владения, что у ApplyExifOrientation ниже).
        private static SKBitmap ResizeToMaxDimension(SKBitmap bitmap, int maxDimension)
        {
            var longestSide = Math.Max(bitmap.Width, bitmap.Height);
            if (longestSide <= maxDimension) return bitmap;

            var scale = (double)maxDimension / longestSide;
            var newWidth = Math.Max(1, (int)Math.Round(bitmap.Width * scale));
            var newHeight = Math.Max(1, (int)Math.Round(bitmap.Height * scale));

            var resized = bitmap.Resize(new SKImageInfo(newWidth, newHeight), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
            if (resized == null) return bitmap;

            bitmap.Dispose();
            return resized;
        }

        // EXIF хранит 8 возможных ориентаций (origin) вместо восьми поворотов пикселей —
        // Skia декодирует "как лежит в файле", поворот/зеркалирование нужно применить вручную.
        // Владение: всегда возвращает новый объект-владелец, входной bitmap диспозится здесь
        // (в том числе когда TopLeft — тогда возвращается тот же объект без изменений).
        private static SKBitmap ApplyExifOrientation(SKBitmap bitmap, SKEncodedOrigin origin)
        {
            if (origin == SKEncodedOrigin.TopLeft) return bitmap;

            SKBitmap Transform(int degrees, bool mirror)
            {
                var swapDimensions = degrees == 90 || degrees == 270;
                var width = swapDimensions ? bitmap.Height : bitmap.Width;
                var height = swapDimensions ? bitmap.Width : bitmap.Height;

                var result = new SKBitmap(width, height);
                using var canvas = new SKCanvas(result);
                canvas.Translate(width / 2f, height / 2f);
                if (mirror) canvas.Scale(-1, 1);
                canvas.RotateDegrees(degrees);
                canvas.Translate(-bitmap.Width / 2f, -bitmap.Height / 2f);
                canvas.DrawBitmap(bitmap, 0, 0, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
                return result;
            }

            var transformed = origin switch
            {
                SKEncodedOrigin.BottomRight => Transform(180, mirror: false),
                SKEncodedOrigin.RightTop => Transform(90, mirror: false),
                SKEncodedOrigin.LeftBottom => Transform(270, mirror: false),
                SKEncodedOrigin.TopRight => Transform(0, mirror: true),
                SKEncodedOrigin.BottomLeft => Transform(180, mirror: true),
                SKEncodedOrigin.RightBottom => Transform(90, mirror: true),
                SKEncodedOrigin.LeftTop => Transform(270, mirror: true),
                _ => bitmap,
            };

            if (!ReferenceEquals(transformed, bitmap)) bitmap.Dispose();
            return transformed;
        }

        private static string ExtensionFor(string contentType) => contentType switch
        {
            "image/png" => "png",
            "image/webp" => "webp",
            _ => "jpg",
        };

        private static SKEncodedImageFormat FormatFor(string contentType) => contentType switch
        {
            "image/png" => SKEncodedImageFormat.Png,
            "image/webp" => SKEncodedImageFormat.Webp,
            _ => SKEncodedImageFormat.Jpeg,
        };

        // PNG — lossless-кодек, quality у него не применяется; JPEG/WebP-оригинал сжимаем мягко
        // (92), это всё ещё "оригинал для быстрого интернета", не финальный компрессированный вариант.
        private static int OriginalQualityFor(string contentType) => 92;
    }
}
