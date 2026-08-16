using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.Services;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Entities;
using ATTours.Common.Extensions;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.Common.Settings;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Обновление тура целиком: загружает существующий tracked-граф тем же набором Include,
    // что и чтение, и сверяет входящий desired-state по Id (add/update/remove) на всех уровнях.
    public class TourUpdateService : EntityActionServiceBase<Tour, ATToursContextFactory>
    {
        private Tour updatedTour;

        public TourUpdateService(Tour entity, CancellationToken cancellationToken = default)
            : base(entity, CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
        }

        // Возвращает обновлённый tracked-тур (после SaveChanges) для маппинга в DTO.
        public async Task<Tour> UpdateAsync()
        {
            await ExecuteEntityChangesAsync();
            return updatedTour;
        }

        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            var incoming = Entities.Single();

            await new TourValidationService([incoming], Context).ValidateEntitiesAsync();

            // AsSplitQuery (2026-08-16, see TourClientInfo.GetClientDetailAsync): same cartesian
            // explosion as the read paths, here on the TRACKED load-before-reconcile — a tour
            // with a large day-by-day photo gallery made every save slow too. Safe with tracked
            // queries (EF Core supports the combination); the reconcile below still edits this
            // same tracked graph and calls SaveChanges as one unit.
            var existing = await EntityRepository.AsQueryable()
                                                 .IncludeTourGraph()
                                                 .AsSplitQuery()
                                                 .SingleOrDefaultAsync(x => x.Id == incoming.Id, CancellationToken)
                           ?? throw new ErrorModelException(GlobalErrorCode.TourNotFound, HttpStatusCode.NotFound, $"Tour with id {incoming.Id} not found.");

            // Тип продукта неизменяем после создания: тур нельзя превратить в экскурсию и наоборот.
            if (existing.Type != incoming.Type)
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest, "Tour type cannot be changed after creation!");

            // Скалярные поля тура (IsActive/IsArchived/TotalPrice здесь не трогаем).
            existing.MainImageUrl = incoming.MainImageUrl;
            existing.RequiresPrepayment = incoming.RequiresPrepayment;

            ReconcileCollection(existing.Translations, incoming.Translations,
                (target, src) => { target.Type = src.Type; target.LanguageCode = src.LanguageCode; target.Value = src.Value; });

            ReconcileCollection(existing.AdditionalExpenses, incoming.AdditionalExpenses, (target, src) =>
            {
                target.Amount = src.Amount;
                // Ссылка на каталог (3.4) переносится так же, как Amount — правило null/[] тут
                // не применяется (оно только для Regions, §3.2.9).
                target.ExpenseTemplateId = src.ExpenseTemplateId;
                ReconcileCollection(target.Translations, src.Translations,
                    (t, s) => { t.Type = s.Type; t.LanguageCode = s.LanguageCode; t.Value = s.Value; });
            });

            // Орг. детали и ограничения — одна коллекция, вид задаёт Type (ADR 003).
            // Type переносится вместе с SortOrder: заметку можно перенести из одного списка
            // в другой, не пересоздавая её. SortOrder осмыслен только внутри своего Type —
            // сверять его между заметками разных типов нельзя.
            ReconcileCollection(existing.Notes, incoming.Notes, (target, src) =>
            {
                target.Type = src.Type;
                target.SortOrder = src.SortOrder;
                target.TourNoteTemplateId = src.TourNoteTemplateId;
                ReconcileCollection(target.Translations, src.Translations,
                    (t, s) => { t.LanguageCode = s.LanguageCode; t.Value = s.Value; });
            });

            // Contract rule (backend-stage3-architecture.md §3.2.9): Regions == null (поле
            // отсутствует в запросе) — не трогаем регионы тура; Regions == [] — очищаем все.
            // Осознанная асимметрия с остальными коллекциями графа тура — защита от стирания
            // регионов админкой в окне между 3.2 и 4.4 (пока она не умеет присылать regions).
            if (incoming.TourRegions is not null)
            {
                ReconcileCollection(existing.TourRegions, incoming.TourRegions,
                    (target, src) => { target.RegionId = src.RegionId; target.SortOrder = src.SortOrder; });
            }

            // Тот же null/[] контракт, что у Regions выше.
            if (incoming.TourTags is not null)
            {
                ReconcileCollection(existing.TourTags, incoming.TourTags,
                    (target, src) => { target.TagId = src.TagId; });
            }

            await ReconcileTourDays(existing, incoming);

            // Compute-on-write: пересчёт после всех day-диффов.
            existing.TotalPrice = existing.TourDetails.Sum(td => td.TourDay.Price);

            updatedTour = existing;
            await Task.CompletedTask;
        }

        // Дни подключены к туру через join TourDetail (композитный ключ, без своего Id),
        // поэтому сверяются отдельно по TourDay.Id.
        private async Task ReconcileTourDays(Tour existing, Tour incoming)
        {
            var existingDetailsByDayId = existing.TourDetails.ToDictionary(td => td.TourDay.Id);
            var incomingDayIds = new HashSet<int>();
            var tourDayRepository = new EntityRepository<TourDay>(Context);

            foreach (var incomingDetail in incoming.TourDetails)
            {
                var incomingDay = incomingDetail.TourDay;
                var sortOrder = incomingDetail.SortOrder;

                if (incomingDay.Id == default)
                {
                    // Новый день: цепляем через новую join-строку к существующему туру.
                    existing.TourDetails.Add(new TourDetail
                    {
                        Tour = existing,
                        TourDay = incomingDay,
                        SortOrder = sortOrder
                    });
                    continue;
                }

                if (!existingDetailsByDayId.TryGetValue(incomingDay.Id, out var existingDetail))
                    throw InvalidEntityIds(incomingDay.Id);

                var existingDay = existingDetail.TourDay;
                existingDay.Price = incomingDay.Price;
                existingDetail.SortOrder = sortOrder;

                ReconcileCollection(existingDay.Translations, incomingDay.Translations,
                    (t, s) => { t.Type = s.Type; t.LanguageCode = s.LanguageCode; t.Value = s.Value; });

                ReconcileCollection(existingDay.GalleryImages, incomingDay.GalleryImages,
                    (t, s) => { t.Url = s.Url; t.SortOrder = s.SortOrder; });

                ReconcileCollection(existingDay.RoutePoints, incomingDay.RoutePoints, (t, s) =>
                {
                    t.SortOrder = s.SortOrder;
                    t.PlaceId = s.PlaceId;
                    ReconcileCollection(t.Translations, s.Translations,
                        (tt, ss) => { tt.LanguageCode = ss.LanguageCode; tt.Value = ss.Value; });
                });

                incomingDayIds.Add(incomingDay.Id);
            }

            // Дни, которых нет во входящем payload — удаляем вместе с join-строкой.
            foreach (var staleDetail in existing.TourDetails
                                                .Where(td => td.TourDay.Id != default && !incomingDayIds.Contains(td.TourDay.Id))
                                                .ToList())
            {
                existing.TourDetails.Remove(staleDetail);
                tourDayRepository.Delete(staleDetail.TourDay);
            }

            await Task.CompletedTask;
        }

        // Сверяет коллекцию детей по Id: Id==0 → add, совпадающий Id → applyUpdate,
        // отсутствующий во входящих Id → remove. Чужой (не принадлежащий родителю) Id → ошибка.
        private void ReconcileCollection<T>(ICollection<T> existing, ICollection<T> incoming, Action<T, T> applyUpdate)
            where T : class, IEntity
        {
            var incomingItems = incoming ?? [];
            var existingById = existing.Where(e => e.Id != default).ToDictionary(e => e.Id);
            var touchedIds = new HashSet<int>();

            foreach (var incomingItem in incomingItems)
            {
                if (incomingItem.Id == default)
                {
                    existing.Add(incomingItem);
                    continue;
                }

                if (!existingById.TryGetValue(incomingItem.Id, out var target))
                    throw InvalidEntityIds(incomingItem.Id);

                applyUpdate(target, incomingItem);
                touchedIds.Add(incomingItem.Id);
            }

            foreach (var stale in existing.Where(e => e.Id != default && !touchedIds.Contains(e.Id)).ToList())
                existing.Remove(stale);
        }

        private static ErrorModelException InvalidEntityIds(int id)
        {
            var message = string.Format(GlobalErrorCode.InvalidEntityIds.TryGetDescriptionName(), id);
            return new ErrorModelException(GlobalErrorCode.InvalidEntityIds, HttpStatusCode.BadRequest, message);
        }
    }
}
