using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.AuthServices;
using ATTours.BusinessServices.Services.Authorization;
using ATTours.Common.DTO.Auth;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Админ отправляет клиенту письмо со ссылкой на сброс пароля (2026-08-27). В отличие от
    // ForcePasswordReset (флаг ForceToChangePass) здесь пользователю реально уходит письмо,
    // и в отличие от ForgotPassword адресат берётся из БД по id, а не из введённого адреса —
    // поэтому анти-энумерация не нужна и ответ обычный.
    //
    // Выпуск токена и отправку письма делает AuthService: инвариант «один активный токен на
    // (UserId, Type)» (ADR 006) принадлежит ему, дублировать его здесь нельзя. Он же —
    // единственный сервис, который UsersController получает через DI, а не через `new`
    // (ADR 005/028), поэтому передаётся сюда параметром конструктора.
    public class UserAdminPasswordResetService : RepositoryCoreBase<User, ATToursContextFactory>
    {
        private readonly IAuthService authService;
        private readonly CancellationToken cancellationToken;

        public UserAdminPasswordResetService(IAuthService authService, CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.authService = authService;
            this.cancellationToken = cancellationToken;
        }

        public async Task<MessageResultModel> SendPasswordResetEmailAsync(int targetUserId, int actingUserId,
            RequestContextModel requestContext)
        {
            var user = await EntityRepository.AsQueryable()
                                             .SingleOrDefaultAsync(x => x.Id == targetUserId && !x.IsDeleted, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"User with id {targetUserId} not found.");

            // Учётку SuperAdmin'а «сбрасывает» только он сам: письмо со ссылкой на смену
            // пароля, отправленное кем-то другим, — это путь к захвату самой
            // привилегированной учётки.
            SuperAdminGuard.GuardSuperAdminTarget(user, actingUserId);

            return await authService.SendPasswordResetEmailAsync(user, requestContext, cancellationToken);
        }
    }
}
