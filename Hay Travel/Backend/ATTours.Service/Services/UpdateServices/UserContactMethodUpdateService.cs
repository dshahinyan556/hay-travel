using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.Shared;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.DTO.Account;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Правка своей строки справочника способов связи (батч 2026-08-29). Точечный сервис по
    // образцу UserPhoneUpdateService: грузит одну строку по паре Id + UserId, поэтому чужую
    // этим сервисом не достать и ролевые guard-проверки здесь не нужны.
    //
    // Уже созданные заказы правка НЕ трогает — там лежит снимок значений (ADR 032 Р1).
    public class UserContactMethodUpdateService : RepositoryCoreBase<UserContactMethod, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public UserContactMethodUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<UserContactMethod> UpdateAsync(ContactMethodUpdateModel model, int userId)
        {
            var contact = await LoadOwnAsync(model.Id, userId);

            contact.Type = model.Type;
            // Нормализация ДО валидации — по той же причине, что и в сервисе создания.
            contact.Value = ContactMethodValidator.Normalize(model.Type, model.Value);
            contact.FirstName = model.FirstName?.Trim();
            contact.LastName = model.LastName?.Trim();

            // Валидация вызывается напрямую: у точечного сервиса на RepositoryCoreBase нет
            // конвейера CreateVerifiableEntityBase, но правило обязано быть тем же самым.
            await new UserContactMethodValidationService([contact], Context).ValidateEntitiesAsync();

            // Флаг «основной» правкой не СНИМАЕТСЯ: профиль без основного контакта не бывает.
            // Поставить его можно, снять — только назначив основным другой контакт
            // (SetPrimaryAsync), поэтому здесь обрабатывается лишь переход false -> true.
            if (model.IsPrimary)
            {
                await ClearPrimaryAsync(userId, contact.Id);
                contact.IsPrimary = true;
            }

            await EntityRepository.SaveChangesAsync(cancellationToken);

            return contact;
        }

        // Снять IsPrimary со всех строк пользователя и поставить целевой. Инвариант
        // «не больше одного основного» держится здесь, а не уникальным индексом (ADR 032 Р4):
        // порядок UPDATE-ов внутри одного SaveChanges EF не гарантирует, и filtered-индекс
        // превращался бы в плавающий сбой ровно на самой частой операции экрана.
        public async Task SetPrimaryAsync(int id, int userId)
        {
            var contact = await LoadOwnAsync(id, userId);

            await ClearPrimaryAsync(userId, contact.Id);
            contact.IsPrimary = true;

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }

        private async Task<UserContactMethod> LoadOwnAsync(int id, int userId)
        {
            return await EntityRepository.AsQueryable()
                                         .SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
                   ?? throw new ErrorModelException(GlobalErrorCode.ContactMethodNotFound, HttpStatusCode.NotFound,
                       $"Contact method with id {id} not found.");
        }

        private async Task ClearPrimaryAsync(int userId, int exceptId)
        {
            var others = await Context.Set<UserContactMethod>()
                                      .Where(contact => contact.UserId == userId && contact.Id != exceptId && contact.IsPrimary)
                                      .ToListAsync(cancellationToken);

            foreach (var other in others)
                other.IsPrimary = false;
        }
    }
}
