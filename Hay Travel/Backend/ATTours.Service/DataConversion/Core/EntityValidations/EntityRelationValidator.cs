using ATTours.BusinessServices.DataConversion.Core.StaticValidations;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.Common.Extensions;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.ContextRepository;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.DataConversion.Core.EntityValidations
{
    public class EntityRelationValidator<TEntity, TRelatedEntity, TContextFactory> : RepositoryCoreBase<TEntity, TContextFactory>, IEntityValidation
       where TEntity : class, IEntity
       where TRelatedEntity : class, IRelatedEntity
       where TContextFactory : IApplicationContextFactory, new()
    {
        private readonly int entityId;
        private readonly List<TRelatedEntity> relatedEntities;

        public EntityRelationValidator(int entityId, List<TRelatedEntity> relatedEntities, IApplicationDbContext context)
            : base(context)
        {
            this.entityId = entityId;
            this.relatedEntities = relatedEntities;
        }

        public async Task ValidateEntitiesAsync()
        {
            EntityRelationValidation.ValidateRelationalEntities(entityId, relatedEntities);

            if (!await EntityRepository.AsQueryable().AsNoTracking().AnyAsync(x => x.Id == entityId))
                throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.BadRequest,
                                              GlobalErrorCode.RelationalEntityNotFound.TryGetDescriptionName());
        }
    }
}
