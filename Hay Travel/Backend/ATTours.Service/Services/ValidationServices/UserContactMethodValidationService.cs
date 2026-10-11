using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.BusinessServices.Services.Shared;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация строки справочника способов связи (батч 2026-08-29). Одна на создание и на
    // правку: правило «как выглядит корректный контакт» обязано быть одинаковым на обоих
    // путях, поэтому UserContactMethodUpdateService вызывает этот же класс напрямую.
    //
    // Формат значения НЕ дублируется здесь регуляркой — он живёт в ContactMethodValidator,
    // общем с валидацией заказа (иначе две копии разъедутся).
    //
    // Валидация видит УЖЕ нормализованное значение: сервисы вызывают её после enrich'а.
    internal class UserContactMethodValidationService : EntityValidationContextDependentBase<UserContactMethod, ATToursContextFactory>
    {
        public UserContactMethodValidationService(List<UserContactMethod> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                // Фамилия необязательна (решение Давида, 2026-08-29) — здесь то же правило, что и
                // в OrderValidationService: справочник и заказ обязаны требовать ОДНО И ТО ЖЕ,
                // иначе сохранённый контакт нельзя было бы отправить в заказ.
                if (string.IsNullOrWhiteSpace(entity.FirstName))
                    throw new ErrorModelException(GlobalErrorCode.RequiredFieldMissing, HttpStatusCode.BadRequest,
                        "Contact method requires a first name.");

                if (!ContactMethodValidator.IsValid(entity.Type, entity.Value))
                    throw new ErrorModelException(GlobalErrorCode.InvalidContactValue, HttpStatusCode.BadRequest,
                        $"Contact value is not valid for method {entity.Type}.");

                await ValidateProfileLimitAsync(entity);
            }
        }

        // Потолок справочника. Правимая строка исключается по Id — иначе двадцатый контакт
        // нельзя было бы отредактировать, он считал бы сам себя.
        private async Task ValidateProfileLimitAsync(UserContactMethod entity)
        {
            var existingCount = await Context.Set<UserContactMethod>()
                                             .CountAsync(contact => contact.UserId == entity.UserId && contact.Id != entity.Id);

            if (existingCount >= ContactLimits.MaxProfileContacts)
                throw new ErrorModelException(GlobalErrorCode.TooManyContactMethods, HttpStatusCode.BadRequest,
                    $"Profile cannot have more than {ContactLimits.MaxProfileContacts} contact methods.");
        }
    }
}
