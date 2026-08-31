using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.BusinessServices.Services.Shared;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.CreateServices
{
    // Новая строка справочника способов связи (батч 2026-08-29).
    //
    // Владельца ставит сервер из токена, а не тело запроса: иначе эндпоинт позволял бы
    // завести контакт в чужом профиле. Здесь же держится инвариант «не больше одного
    // основного на пользователя» — уникального индекса под него нет сознательно (ADR 032 Р4).
    public class UserContactMethodCreationService : CreateVerifiableEntityBase<UserContactMethod, ATToursContextFactory>
    {
        private readonly int userId;

        public UserContactMethodCreationService(UserContactMethod entity, int userId, CancellationToken cancellationToken = default)
            : base(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
            this.userId = userId;
        }

        public UserContactMethodCreationService(UserContactMethod entity, int userId, IApplicationDbContext context,
            CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
            this.userId = userId;
        }

        protected override IEntityValidation GetEntityValidation()
            => new UserContactMethodValidationService([.. Entities], Context);

        // Обогащение идёт ДО валидации (тот же порядок, что у заказа): валидация обязана
        // видеть уже нормализованное значение, иначе номер с пробелами и скобками отбивался
        // бы как неверный, хотя в БД лёг бы корректный.
        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            await EnrichAsync();
            await base.ExecuteEntityChangesFactoryAsync();
        }

        private async Task EnrichAsync()
        {
            var entity = Entities.Single();

            entity.UserId = userId;
            entity.Value = ContactMethodValidator.Normalize(entity.Type, entity.Value);
            entity.FirstName = entity.FirstName?.Trim();
            entity.LastName = entity.LastName?.Trim();

            // Строки справочника берутся трекнутыми: снятие флага у остальных уезжает тем же
            // SaveChangesAsync базового класса, что и вставка новой — одна транзакция.
            var existing = await Context.Set<UserContactMethod>()
                                        .Where(contact => contact.UserId == userId)
                                        .ToListAsync(CancellationToken);

            // Первый контакт профиля всегда основной, что бы ни прислал клиент: иначе
            // справочник остался бы без основного и форме заказа нечем предзаполняться.
            if (existing.Count == 0)
            {
                entity.IsPrimary = true;
                return;
            }

            if (!entity.IsPrimary)
                return;

            foreach (var contact in existing)
                contact.IsPrimary = false;
        }
    }
}
