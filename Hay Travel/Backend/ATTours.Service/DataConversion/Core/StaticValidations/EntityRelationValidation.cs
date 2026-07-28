using ATTours.Common.Extensions;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.DataConversion.Core.StaticValidations
{
    public static class EntityRelationValidation
    {
        public static void ValidateRelationalEntities<TEntity>(int relatedEntityId, List<TEntity> entities)
            where TEntity : IRelatedEntity
        {
            ValidateRelationalEntityId(relatedEntityId);
            if (entities.Any(x => x.RelatedEntityId != relatedEntityId))
                throw new ErrorModelException(GlobalErrorCode.InvalidEntityRelation, HttpStatusCode.BadRequest,
                                              GlobalErrorCode.InvalidEntityRelation.TryGetDescriptionName());
        }

        public static void ValidateRelationalEntityId(int relatedEntityId)
        {
            if (relatedEntityId == default)
                throw new ErrorModelException(GlobalErrorCode.EntityRelationIdIsDefault, HttpStatusCode.BadRequest,
                                              GlobalErrorCode.EntityRelationIdIsDefault.TryGetDescriptionName());
        }
    }
}
