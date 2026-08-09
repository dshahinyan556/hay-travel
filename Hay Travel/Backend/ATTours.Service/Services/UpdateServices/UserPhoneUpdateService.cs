using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Самостоятельная смена своего телефона (A4, 2026-08-09). Точечная операция по образцу
    // UserRoleUpdateService: грузит одну строку и меняет одно поле.
    //
    // Владелец операции — сам пользователь (AccountController передаёт User.GetUserId()),
    // поэтому никаких ролевых guard'ов здесь нет: чужую строку этим сервисом не достать.
    public class UserPhoneUpdateService : RepositoryCoreBase<User, ATToursContextFactory>
    {
        // Фактическая ширина колонки User.PhoneNumber (UserConfiguration.HasMaxLength(15)).
        // Формат хранения не меняется — номер лежит БЕЗ ведущего "+" (см. сид админа и
        // AuthService.RegisterAsync).
        private const int PhoneNumberMaxLength = 15;

        private readonly CancellationToken cancellationToken;

        public UserPhoneUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<User> UpdatePhoneAsync(int userId, string? phoneNumber)
        {
            // Include(Role) — контроллер отдаёт UserInfoModel, а его маппинг читает Role.Type.
            // !IsDeleted: удалённый пользователь отвечает 404, как и несуществующий.
            var user = await EntityRepository.AsQueryable()
                                             .Include(x => x.Role)
                                             .SingleOrDefaultAsync(x => x.Id == userId && !x.IsDeleted, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {userId} not found.");

            var normalizedPhoneNumber = Normalize(phoneNumber);

            // Единственная проверка формата на бэке — длина: иначе номер молча обрезался бы
            // (или падал бы SqlException) на записи в nvarchar(15).
            if (normalizedPhoneNumber is not null && normalizedPhoneNumber.Length > PhoneNumberMaxLength)
                throw new ErrorModelException(GlobalErrorCode.DataFormatMismatch, HttpStatusCode.BadRequest,
                    $"Phone number must be at most {PhoneNumberMaxLength} characters long.");

            user.PhoneNumber = normalizedPhoneNumber;
            await EntityRepository.SaveChangesAsync(cancellationToken);

            return user;
        }

        // "" -> null: тот же приём, что в AuthService.RegisterAsync — не даёт в БД жить двум
        // представлениям «нет телефона». Ведущий "+" снимается, а не отвергается: формат
        // хранения — без него, и фронт, приславший E.164, не должен получать 400 на ровном месте.
        private static string? Normalize(string? phoneNumber)
        {
            var trimmedPhoneNumber = phoneNumber?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedPhoneNumber))
                return null;

            return trimmedPhoneNumber.StartsWith('+') ? trimmedPhoneNumber[1..].Trim() : trimmedPhoneNumber;
        }
    }
}
