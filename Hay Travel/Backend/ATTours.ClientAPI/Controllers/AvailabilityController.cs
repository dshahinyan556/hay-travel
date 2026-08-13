using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.DeleteServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.ClientAPI.Authorization;
using ATTours.Common.DTO.Info;
using ATTours.Common.DTO.Init;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Занятость и правила закрытия (spec 001, ADR 012). Админ-календарь и управление
    // правилами — только для админа; публичным остаётся единственный эндпоинт
    // GetClosedDates, которым booking-card гасит недоступные дни.
    [ApiController]
    [Route("api/[controller]")]
    public class AvailabilityController(IMapper mapper) : Controller
    {
        // Месяц целиком: закрытия + занятость по дням. Собирается сервисом, не маппером.
        [HttpGet]
        [Route("GetCalendar")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<CalendarMonthModel> GetCalendarAsync([FromQuery] int year, [FromQuery] int month, CancellationToken cancellationToken)
        {
            using var info = new OrderCalendarInfo(cancellationToken);
            return await info.GetMonthAsync(year, month);
        }

        // Фильтр по туру отдаёт правила тура ВМЕСТЕ с глобальными: на день тура влияют оба
        // набора, и админке нужно видеть полную картину, а не только tour-scope строки.
        [HttpGet]
        [Route("GetRules")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<List<ClosureRuleInfoModel>> GetRulesAsync([FromQuery] int? tourId, CancellationToken cancellationToken)
        {
            using var info = new ClosureRuleInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);

            var rules = tourId.HasValue
                ? await info.GetAllAsync(rule => rule.TourId == null || rule.TourId == tourId)
                : await info.GetAllAsync();

            return mapper.Map<List<ClosureRuleInfoModel>>(rules);
        }

        // Массовое закрытие/открытие: список правил создаётся одной транзакцией.
        // Редактирования правил нет — изменение это удалить + создать (ADR 012).
        [HttpPost]
        [Route("CreateRules")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task<List<ClosureRuleInfoModel>> CreateRulesAsync([FromBody] List<ClosureRuleCreateModel> models, CancellationToken cancellationToken)
        {
            var entities = mapper.Map<List<ClosureRule>>(models);

            using (var creationService = new ClosureRuleCreationService(entities, cancellationToken))
                await creationService.ExecuteEntityChangesAsync();

            var createdIds = entities.Select(entity => entity.Id).ToList();

            using var info = new ClosureRuleInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return mapper.Map<List<ClosureRuleInfoModel>>(await info.GetAllAsync(rule => createdIds.Contains(rule.Id)));
        }

        [HttpDelete]
        [Route("DeleteRule")]
        [Authorize(Roles = ApiRoles.Admin)]
        public async Task DeleteRuleAsync([FromQuery] int id, CancellationToken cancellationToken)
        {
            using var deletionService = new ClosureRuleDeletionService(cancellationToken);
            await deletionService.DeleteAsync(id);
        }

        #region ClientEndpoints
        // Публичный намеренно (как GetForClient у PlaceController): booking-card на сайте
        // должен гасить закрытые дни ещё до логина, а наружу уходят только даты.
        [HttpGet]
        [Route("GetClosedDates")]
        public async Task<List<DateOnly>> GetClosedDatesAsync([FromQuery] int tourId, [FromQuery] DateOnly from,
            [FromQuery] DateOnly to, CancellationToken cancellationToken)
        {
            using var info = new ClosureRuleInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken);
            return await info.GetClosedDatesAsync(tourId, from, to);
        }
        #endregion
    }
}
