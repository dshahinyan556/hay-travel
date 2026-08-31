using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация набора исключений из порога автозакрытия (батч 2026-08-29).
    //
    // Проверяется ровно то же, что проверяет форма на экране: порог положительный, продукт
    // существует, один продукт не повторяется дважды. Дублировать фронтовые правила на
    // сервере обязательно — фронтовая валидация это UX, а не граница: сюда можно прийти
    // прямым PUT в обход экрана.
    //
    // Валидируется ВЕСЬ набор сразу, а не строка за строкой: дубликат — свойство набора, и
    // увидеть его можно только имея перед собой все строки запроса.
    internal class TourAutoCloseOverrideValidationService
        : EntityValidationContextDependentBase<TourAutoCloseOverride, ATToursContextFactory>
    {
        public TourAutoCloseOverrideValidationService(List<TourAutoCloseOverride> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            ValidateNoDuplicates();

            foreach (var entity in Entities)
                ValidateLeadTime(entity);

            await ValidateToursExistAsync();
        }

        // Дубль отвергается запросом, а не уникальным индексом: индекс сработал бы уже на
        // SaveChanges и приехал бы клиенту 500-й, а не понятным кодом.
        private void ValidateNoDuplicates()
        {
            var duplicate = Entities.GroupBy(entity => entity.TourId)
                                    .FirstOrDefault(group => group.Count() > 1);

            if (duplicate is not null)
                throw new ErrorModelException(GlobalErrorCode.DuplicateAutoCloseOverride, HttpStatusCode.BadRequest,
                    $"Auto-close override for tour {duplicate.Key} is specified more than once.");
        }

        private static void ValidateLeadTime(TourAutoCloseOverride entity)
        {
            if (entity.LeadTimeHours <= 0)
                throw new ErrorModelException(GlobalErrorCode.InvalidAutoCloseOverride, HttpStatusCode.BadRequest,
                    $"Auto-close lead time for tour {entity.TourId} must be positive, got {entity.LeadTimeHours}.");
        }

        // Существование продуктов — ОДНИМ запросом на весь набор, а не по запросу на строку:
        // строк тут единицы, но правило «справочные данные грузим пачкой» одно на все
        // валидации (см. OrderValidationService.LoadReferenceDataAsync).
        private async Task ValidateToursExistAsync()
        {
            var tourIds = Entities.Select(entity => entity.TourId).Distinct().ToList();
            if (tourIds.Count == 0)
                return;

            var existingIds = await Context.Set<Tour>()
                                           .AsNoTracking()
                                           .Where(tour => tourIds.Contains(tour.Id))
                                           .Select(tour => tour.Id)
                                           .ToListAsync();

            // Список, а не FirstOrDefault: «нет такого продукта» и «прислали TourId = 0»
            // это одна и та же ошибка, и отличать их по значению по умолчанию нельзя —
            // ноль как раз и есть самый вероятный мусорный ввод.
            var missingIds = tourIds.Except(existingIds).ToList();
            if (missingIds.Count > 0)
                throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.BadRequest,
                    $"Tour with id {missingIds[0]} does not exist.");
        }
    }
}
