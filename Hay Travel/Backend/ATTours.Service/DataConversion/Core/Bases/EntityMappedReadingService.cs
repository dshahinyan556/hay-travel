using ATTours.BusinessServices.CacheCore;
using ATTours.Common.Extensions;
using ATTours.Common.Infrastructure.Abstractions.Interfaces;
using ATTours.ContextRepository;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using AutoMapper;
using System.Collections;

namespace ATTours.BusinessServices.DataConversion.Core.Bases
{
    public abstract class EntityMappedReadingService<TEntity, TContextFactory, TModel> : RepositoryCoreBase<TEntity, TContextFactory>, IEntity<TModel>
        where TEntity : class, IEntity
        where TModel : new()
        where TContextFactory : IApplicationContextFactory, new()
    {
        private readonly IMapper mapper;
        protected readonly CancellationToken cancellationToken;
        protected EntityMappedReadingService(string connectionString, IMapper mapper, CancellationToken cancellationToken = default)
            : base(connectionString)
        {
            this.mapper = mapper;
            this.cancellationToken = cancellationToken;
        }

        protected EntityMappedReadingService(IApplicationDbContext context, IMapper mapper, CancellationToken cancellationToken = default)
            : base(context)
        {
            this.mapper = mapper;
            this.cancellationToken = cancellationToken;
        }

        public async Task<TModel> GetEntity()
        {
            return await GetEntityFactoryAsync();
        }

        protected virtual async Task<TModel> GetEntityFactoryAsync()
        {
            if (typeof(TModel).IsCollection())
            {
                var entities = await GetEntitiesAsync();
                if (((ICollection)entities).IsEmpty())
                    return new();
                return mapper.Map<TModel>(entities);
            }
            else
            {
                var singleEntity = await GetSingleEntityAsync();
                if (singleEntity is null)
                    return default;
                return mapper.Map<TModel>(singleEntity);
            }
        }
        private async Task<List<TEntity>> GetEntitiesAsync() => await GetQueryableRepository().ToListAsync(cancellationToken);

        private async Task<TEntity> GetSingleEntityAsync() => await GetQueryableRepository().FirstOrDefaultAsync(cancellationToken);

        protected virtual IQueryableRepository<TEntity> GetQueryableRepository()
            => GetEntityQueryableRepository();

        protected virtual IEntityQueryableRepository<TEntity> GetEntityQueryableRepository()
            => EntityRepository.AsQueryable().AsNoTracking();
    }
}
