using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация формы правила закрытия (ADR 012). Дискриминатор Type определяет, какое
    // поле обязано быть заполнено, а какое обязано быть пустым: правило с обоими полями
    // (или без единого) резолвер трактовать не сможет.
    internal class ClosureRuleValidationService : EntityValidationContextDependentBase<ClosureRule, ATToursContextFactory>
    {
        public ClosureRuleValidationService(List<ClosureRule> entities, IApplicationDbContext context)
            : base(entities, context)
        {
        }

        public override async Task ValidateEntitiesAsync()
        {
            foreach (var entity in Entities)
            {
                ValidateScope(entity);
                ValidateShape(entity);
                ValidateEffectiveRange(entity);
                ValidateNotInPast(entity);
                await ValidateTourAsync(entity);
            }
        }

        // Бэкдейтинг запрещён везде (B12, 2026-08-13) — раньше bulk-закрытие намеренно
        // разрешало прошедшие даты ("хозяйственный смысл"), а одиночный клик по прошедшему
        // дню вообще не проверялся. Решение Давида: запретить и там, и там, без исключений.
        private static void ValidateNotInPast(ClosureRule rule)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            if (rule.Type == ClosureRuleType.SpecificDate && rule.Date < today)
                throw new ErrorModelException(GlobalErrorCode.ClosureDateInPast, HttpStatusCode.BadRequest,
                    $"Closure date {rule.Date:yyyy-MM-dd} is in the past.");

            if (rule.Type == ClosureRuleType.Weekly && rule.EffectiveFrom is not null && rule.EffectiveFrom < today)
                throw new ErrorModelException(GlobalErrorCode.ClosureDateInPast, HttpStatusCode.BadRequest,
                    $"Closure effective-from date {rule.EffectiveFrom:yyyy-MM-dd} is in the past.");
        }

        // Область действия правила (решение 0.27): ЛИБО один продукт, ЛИБО целый тип
        // продукта, ЛИБО глобально. Оба поля сразу резолвер трактовать не сможет —
        // такое правило пришлось бы одновременно ранжировать как tour-scope и как
        // type-scope, и его исход зависел бы от порядка проверок, а не от данных.
        private static void ValidateScope(ClosureRule rule)
        {
            if (rule.TourType is null)
                return;

            if (rule.TourId is not null)
                throw new ErrorModelException(GlobalErrorCode.InvalidClosureRule, HttpStatusCode.BadRequest,
                    "Closure rule cannot target a single tour and a whole product type at the same time.");

            if (!Enum.IsDefined(rule.TourType.Value))
                throw new ErrorModelException(GlobalErrorCode.InvalidClosureRule, HttpStatusCode.BadRequest,
                    $"Closure rule product type {(int)rule.TourType.Value} is unknown.");
        }

        private static void ValidateShape(ClosureRule rule)
        {
            switch (rule.Type)
            {
                case ClosureRuleType.SpecificDate when rule.Date is null || rule.DayOfWeek is not null:
                    throw new ErrorModelException(GlobalErrorCode.InvalidClosureRule, HttpStatusCode.BadRequest,
                        "Closure rule of type SpecificDate must carry Date and must not carry DayOfWeek.");

                case ClosureRuleType.Weekly when rule.DayOfWeek is null || rule.Date is not null:
                    throw new ErrorModelException(GlobalErrorCode.InvalidClosureRule, HttpStatusCode.BadRequest,
                        "Closure rule of type Weekly must carry DayOfWeek and must not carry Date.");

                case ClosureRuleType.SpecificDate:
                case ClosureRuleType.Weekly:
                    return;

                default:
                    throw new ErrorModelException(GlobalErrorCode.InvalidClosureRule, HttpStatusCode.BadRequest,
                        $"Closure rule type {(int)rule.Type} is unknown.");
            }
        }

        private static void ValidateEffectiveRange(ClosureRule rule)
        {
            if (rule.EffectiveFrom is not null && rule.EffectiveTo is not null && rule.EffectiveFrom > rule.EffectiveTo)
                throw new ErrorModelException(GlobalErrorCode.InvalidClosureRule, HttpStatusCode.BadRequest,
                    $"Closure rule effective range is inverted: {rule.EffectiveFrom:yyyy-MM-dd} > {rule.EffectiveTo:yyyy-MM-dd}.");
        }

        // TourId == null — легальное состояние (глобальное правило), проверять нечего.
        private async Task ValidateTourAsync(ClosureRule rule)
        {
            if (rule.TourId is null)
                return;

            var tourExists = await Context.Set<Tour>().AnyAsync(tour => tour.Id == rule.TourId.Value);
            if (!tourExists)
                throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.BadRequest,
                    $"Tour with id {rule.TourId.Value} does not exist.");
        }
    }
}
