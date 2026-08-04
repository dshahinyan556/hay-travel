using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Text.RegularExpressions;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Pre-check регистрации: уникальность логина и формат телефона до вставки, чтобы
    // пользователь получал осмысленный код ошибки, а не DuplicateInsert из БД.
    //
    // Занятость email намеренно НЕ бросает исключение и вынесена в отдельный метод:
    // по контракту эндпоинта повторная регистрация на существующий адрес отвечает
    // generic-200 (и переотправляет verify-письмо), иначе по коду ответа перебирались
    // бы зарегистрированные адреса.
    internal class UserRegistrationValidationService : EntityValidationContextDependentBase<User, ATToursContextFactory>
    {
        // Тот же контракт, что уже валидируется на фронте: только цифры, не длиннее 15.
        private static readonly Regex PhoneNumberRegex = new(@"^\d{1,15}$", RegexOptions.Compiled);

        public UserRegistrationValidationService(List<User> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                ValidatePhoneNumber(entity);
                await ValidateUsernameAsync(entity);
            }
        }

        // Возвращает уже существующего пользователя с таким email (или null).
        // Вызывающий сам решает, что с ним делать — переотправить подтверждение или
        // молча ответить generic-сообщением.
        public async Task<User?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
        {
            return await Context.Set<User>()
                                .Include(user => user.Role)
                                .SingleOrDefaultAsync(user => user.Email == email, cancellationToken);
        }

        private static void ValidatePhoneNumber(User user)
        {
            if (string.IsNullOrWhiteSpace(user.PhoneNumber) || !PhoneNumberRegex.IsMatch(user.PhoneNumber))
                throw new ErrorModelException(GlobalErrorCode.RegexDoesNotMatch, HttpStatusCode.BadRequest,
                    "Phone number must contain only digits and be at most 15 characters long.");
        }

        private async Task ValidateUsernameAsync(User user)
        {
            var usernameTaken = await Context.Set<User>()
                                             .AnyAsync(existing => existing.Username == user.Username && existing.Id != user.Id);
            if (usernameTaken)
                throw new ErrorModelException(GlobalErrorCode.UsernameTaken, HttpStatusCode.BadRequest,
                    $"Username '{user.Username}' is already taken.");
        }
    }
}
