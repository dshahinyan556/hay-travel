using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.DataConversion.Core.EntitiesUpdate
{
    public class UpdateEntityBase<TEntity, TContextFactory> : EntityActionServiceBase<TEntity, TContextFactory>
        where TEntity : class, IEntity, new()
        where TContextFactory : IApplicationContextFactory, new()

    {

        #region Constructors
        public UpdateEntityBase(TEntity entity, IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(entity, context, cancellationToken)
        {
        }

        public UpdateEntityBase(List<TEntity> entities, IApplicationDbContext context, CancellationToken cancellationToken = default)
           : base(entities, context, cancellationToken)
        {
        }

        public UpdateEntityBase(TEntity entity, string connectionString, CancellationToken cancellationToken = default)
            : base(entity, connectionString, cancellationToken)
        {
        }

        public UpdateEntityBase(List<TEntity> entities, string connectionString, CancellationToken cancellationToken = default)
            : base(entities, connectionString, cancellationToken)
        {
        }
        #endregion

        protected override async Task SaveEntityChangesAsync()
        {
            await ValidateEntitiesAsync();
            await base.SaveEntityChangesAsync();
        }
        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            EntityRepository.UpdateRange(Entities);
            await Task.CompletedTask;
        }

        protected virtual async Task ValidateEntitiesAsync()
        {
            await ValidateInvalidEntityIdsAsync();
        }

        private async Task ValidateInvalidEntityIdsAsync()
        {
            var existingEntityIds = Entities.Where(x => x.Id != default).Select(x => x.Id).ToList();
            var entityIds = await EntityRepository.AsQueryable().AsNoTracking()
                                                  .Where(x => existingEntityIds.Contains(x.Id)).Select(x => x.Id)
                                                  .ToListAsync(CancellationToken);

            var wrongEntityIds = existingEntityIds.Except(entityIds);
            if (wrongEntityIds.Any())
            {
                var wrongIdsText = string.Join(SymbolType.Comma.ToChar(), wrongEntityIds);
                var errorMessage = string.Format(GlobalErrorCode.InvalidEntityIds.TryGetDescriptionName(), wrongIdsText);
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityIds, HttpStatusCode.BadRequest, errorMessage);
            }
        }
    }
}
