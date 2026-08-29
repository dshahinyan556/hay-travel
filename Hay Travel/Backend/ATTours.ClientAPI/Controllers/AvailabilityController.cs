using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.Authorization;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Init;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Занятость и правила закрытия (spec 001, ADR 012). Админ-календарь и управление
    // правилами — по ключу прав "calendar" (Update у него нет: правка правила это
    // удалить + создать); публичным остаётся единственный эндпоинт GetClosedDates,
    // которым booking-card гасит недоступные дни.
    [ApiController]
    [Route("api/[controller]")]
    public class AvailabilityController(IMapper mapper) : Controller
    {
        // Месяц целиком: закрытия + занятость по дням. Собирается сервисом, не маппером.
        [HttpGet]
        [Route("GetCalendar")]
        [RequiresPermission(AdminScreens.Calendar, PermissionAction.View)]
        public async Task<CalendarMonthModel> GetCalendarAsync([FromQuery] int year, [FromQuery] int month, CancellationToken cancellationToken)
        {
            using var info = new OrderCalendarInfo(cancellationToken);
            return await info.GetMonthAsync(year, month);
        }

        // Фильтр по туру отдаёт правила тура ВМЕСТЕ с глобальными: на день тура влияют оба
        // набора, и админке нужно видеть полную картину, а не только tour-scope строки.
        [HttpGet]
        [Route("GetRules")]
        [RequiresPermission(AdminScreens.Calendar, PermissionAction.View)]
        public async Task<List<ClosureRuleInfoModel>> GetRulesAsync([FromQuery] int? tourId, CancellationToken cancellationToken)
        {
            using var info = new ClosureRuleInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            var rules = tourId.HasValue
                ? await info.GetAllAsync(rule => rule.TourId == null || rule.TourId == tourId)
                : await info.GetAllAsync();

            return mapper.Map<List<ClosureRuleInfoModel>>(rules);
        }

        // Массовое закрытие/открытие: список правил создаётся одной транзакцией и делит один
        // BatchId — так один вызов формы (одиночный toggle или «Массовые операции») остаётся
        // одной группой на экране «Блокировки», а не россыпью визуально неотличимых строк.
        // Редактирования правил нет — изменение это удалить + создать (ADR 012).
        [HttpPost]
        [Route("CreateRules")]
        [RequiresPermission(AdminScreens.Calendar, PermissionAction.Create)]
        public async Task<List<ClosureRuleInfoModel>> CreateRulesAsync([FromBody] List<ClosureRuleCreateModel> models, CancellationToken cancellationToken)
        {
            var entities = mapper.Map<List<ClosureRule>>(models);

            var batchId = Guid.NewGuid();
            foreach (var entity in entities)
                entity.BatchId = batchId;

            using (var creationService = new ClosureRuleCreationService(entities, cancellationToken))
                await creationService.ExecuteEntityChangesAsync();

            var createdIds = entities.Select(entity => entity.Id).ToList();

            using var info = new ClosureRuleInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<List<ClosureRuleInfoModel>>(await info.GetAllAsync(rule => createdIds.Contains(rule.Id)));
        }

        [HttpDelete]
        [Route("DeleteRule")]
        [RequiresPermission(AdminScreens.Calendar, PermissionAction.Delete)]
        public async Task DeleteRuleAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var deletionService = new ClosureRuleDeletionService(cancellationToken);
            await deletionService.DeleteAsync(id);
        }

        // Массовое удаление: группа (все id одного BatchId) или произвольная выборка отмеченных
        // строк — экран «Блокировки» отправляет сюда оба случая одинаково, разница только в том,
        // какие id он собрал перед вызовом.
        [HttpDelete]
        [Route("DeleteRules")]
        [RequiresPermission(AdminScreens.Calendar, PermissionAction.Delete)]
        public async Task DeleteRulesAsync([FromBody] List<int> ids, CancellationToken cancellationToken)
        {
            using var deletionService = new ClosureRuleDeletionService(cancellationToken);
            await deletionService.DeleteManyAsync(ids);
        }

        #region ClientEndpoints
        // Публичный намеренно (как GetForClient у PlaceController): booking-card на сайте
        // должен гасить закрытые дни ещё до логина, а наружу уходят только даты.
        //
        // tourId стал необязательным (решение 0.27): у конструктора кастомного трансфера
        // продукта нет вовсе, и спрашивает он по типу — GetClosedDates?tourType=3. Когда
        // tourId задан, тип продукта берётся из БД, а tourType из запроса игнорируется.
        [HttpGet]
        [Route("GetClosedDates")]
        public async Task<List<DateOnly>> GetClosedDatesAsync([FromQuery] int? tourId, [FromQuery] DateOnly from,
            [FromQuery] DateOnly to, CancellationToken cancellationToken, [FromQuery] TourType? tourType = null)
        {
            using var info = new ClosureRuleInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return await info.GetClosedDatesAsync(tourId, from, to, tourType);
        }

        // Остаток мест группового формата (решения 0.19/0.20 чек-листа
        // checklist-transfers-format-2026-08-29): блок брони показывает «осталось N мест» на
        // выбранные дату+время и блокирует кнопку на нуле.
        //
        // Публичный по той же причине, что и GetClosedDates: гасить недоступные слоты сайт
        // обязан ДО логина. Наружу едут только числа — ни заказов, ни клиентов.
        //
        // Живёт рядом с закрытыми датами, а не в TourController: и то, и другое — «можно ли
        // сюда бронировать», и блок брони спрашивает их одной парой запросов. В детали
        // продукта остаток мест не кладём: та ответка кэшируется и не знает диапазона дат.
        [HttpGet]
        [Route("GetGroupSeats")]
        public async Task<TourGroupSeatsModel> GetGroupSeatsAsync([FromQuery] int tourId, [FromQuery] DateOnly from,
            [FromQuery] DateOnly to, CancellationToken cancellationToken)
        {
            using var info = new GroupSeatsInfo(cancellationToken);
            return await info.GetAsync(tourId, from, to);
        }
        #endregion
    }
}
