using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Удаление правила закрытия. Правила дёшевы и не редактируются: изменение правила =
    // удалить + создать (ADR 012), поэтому PUT-сервиса рядом нет и не должно быть.
    // Ссылок на правило ни у кого нет — проверять «в использовании» нечего.
    public class ClosureRuleDeletionService : RepositoryCoreBase<ClosureRule, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public ClosureRuleDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var rule = await EntityRepository.AsQueryable()
                                             .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                       ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                           $"Closure rule with id {id} not found.");

            EntityRepository.Delete(rule);
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }

        // Массовое удаление — группа правил (один BatchId) или произвольная выборка отмеченных
        // чекбоксами строк, обе с одного экрана «Блокировки» (2026-08-14). В отличие от
        // DeleteAsync ничего не бросает на отсутствующий id: список приходит с уже загруженного
        // экрана, а гонка с параллельным удалением в другой вкладке — не ошибка, а норма для
        // массовой операции, ей не стоит проваливать всю пачку.
        public async Task DeleteManyAsync(List<int> ids)
        {
            if (ids is null || ids.Count == 0)
                return;

            EntityRepository.DeleteWhere(x => ids.Contains(x.Id));
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
