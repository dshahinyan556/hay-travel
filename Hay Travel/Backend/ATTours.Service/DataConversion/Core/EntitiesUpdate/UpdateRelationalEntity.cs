using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.BusinessServices.DataConversionModels.DTO.EntityModels;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.Helper.Helper;

namespace ATTours.BusinessServices.DataConversion.Core.EntitiesUpdate
{
    public class UpdateRelationalEntity<TEntity, TRelatedEntity, TContextFactory> : UpdateEntityBase<TRelatedEntity, TContextFactory>
        where TEntity : class,IEntity, new()
        where TRelatedEntity : class, IRelatedEntity, new()
        where TContextFactory : IApplicationContextFactory, new()
    {
        #region Constructors

        public UpdateRelationalEntity(RelatedEntityUpdateModel<TRelatedEntity> relatedEntityUpdateModel, IApplicationDbContext context,
                                      CancellationToken cancellationToken)
            : base(relatedEntityUpdateModel.RelatedEntities, context, cancellationToken)
        {
            EntityId = relatedEntityUpdateModel.EntityId;
        }

        public UpdateRelationalEntity(RelatedEntityUpdateModel<TRelatedEntity> relatedEntityUpdateModel, string connectionString, CancellationToken cancellationToken = default)
            : base(relatedEntityUpdateModel.RelatedEntities, connectionString, cancellationToken)
        {
            EntityId = relatedEntityUpdateModel.EntityId;
        }

        #endregion

        protected int EntityId { get; }

        private IQueryableRepository<TRelatedEntity> entityQueryableRepository;
        protected IQueryableRepository<TRelatedEntity> EntityQueryableRepository
        {
            get
            {
                if (entityQueryableRepository == null)
                {
                    var containsFilter = ExpressionHelper.CreateRelatedEntityFilterExpression<TRelatedEntity>(new() { EntityId });
                    entityQueryableRepository = EntityRepository.AsQueryable().AsNoTracking().Where(containsFilter);
                }
                return entityQueryableRepository;
            }
        }

        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            await base.ExecuteEntityChangesFactoryAsync();
            await UpdateRelationalEntitiesAsync();
        }

        protected override async Task ValidateEntitiesAsync()
        {
            var entityRelationValidator = new EntityRelationValidator<TEntity, TRelatedEntity, TContextFactory>(EntityId, Entities, Context);
            await entityRelationValidator.ValidateEntitiesAsync();
            await base.ValidateEntitiesAsync();
        }

        private async Task UpdateRelationalEntitiesAsync()
        {
            await RemoveEntitiesAsync();
            UpdateEntities();
            await AddNewEntities();
        }

        private async Task RemoveEntitiesAsync()
        {
            var allRelatedEntityIds = await EntityQueryableRepository.Select(p => p.Id).ToListAsync();

            var removedEntityIds = allRelatedEntityIds.Except(Entities.Where(x => x.Id != default).Select(x => x.Id));

            EntityRepository.DeleteWhere(x => removedEntityIds.Contains(x.Id));
        }

        protected void UpdateEntities()
            => EntityRepository.UpdateRange(Entities.Where(x => x.Id != default));

        private async Task AddNewEntities()
            => await EntityRepository.AddRangeAsync(Entities.Where(x => x.Id == default).ToList());
    }
}
