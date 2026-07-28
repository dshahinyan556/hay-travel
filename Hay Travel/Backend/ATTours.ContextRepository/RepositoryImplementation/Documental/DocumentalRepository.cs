using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Documental;
using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryImplementation.Documental
{
    public class DocumentalRepository<TDocument, TSessionHandle>(IDocumentalContext<TSessionHandle> context, string collectionName) : IDocumentEntityRepository<TDocument, TSessionHandle>
        where TDocument : class
    {
        protected readonly IDocumentalCollection<TDocument, TSessionHandle> collection = context.GetCollection<TDocument>(collectionName);

        #region Implemented Methods
        public async Task AddAsync(TDocument entity, CancellationToken cancellationToken = default)
        {
            await collection.InsertOneAsync(entity, cancellationToken: cancellationToken);
        }
        public async Task AddAsync(TSessionHandle session, TDocument logEvent, CancellationToken cancellationToken = default)
        {
            await collection.InsertOneAsync(session, logEvent, cancellationToken: cancellationToken);
        }

        public async Task UpdateItemAsync<TField>(Expression<Func<TDocument, bool>> filter, Expression<Func<TDocument, TField>> field, TField value, CancellationToken cancellationToken = default)
        {
            await collection.FindOneAndUpdateAsync(filter, field, value, cancellationToken: cancellationToken);
        }
        public async Task UpdateItemAsync<TField>(TSessionHandle session, Expression<Func<TDocument, bool>> filter, Expression<Func<TDocument, TField>> field, TField value, CancellationToken cancellationToken = default)
        {
            await collection.FindOneAndUpdateAsync(session, filter, field, value, cancellationToken: cancellationToken);
        }

        public async Task<List<TDocument>> ToListAsync(Expression<Func<TDocument, bool>> where, CancellationToken cancellationToken = default)
        {
            return await collection.ToListAsync(where, cancellationToken);
        }

        public async Task<TDocument> FirstOrDefaultAsync(Expression<Func<TDocument, bool>> where, CancellationToken cancellationToken = default)
        {
            return await collection.FirstOrDefaultAsync(where, cancellationToken);
        }

        #endregion
    }
}
