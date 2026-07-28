using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryAbstraction.Documental
{
    public interface IDocumentEntityRepository<TDocument, TSessionHandle> : IEntityBaseBaseRepository<TDocument>
        where TDocument : class
    {
        Task UpdateItemAsync<TField>(TSessionHandle session, Expression<Func<TDocument, bool>> filter, Expression<Func<TDocument, TField>> field, 
                                     TField value, CancellationToken cancellationToken = default);

        Task UpdateItemAsync<TField>(Expression<Func<TDocument, bool>> filter, Expression<Func<TDocument, TField>> field,
                                     TField value, CancellationToken cancellationToken = default);

        Task<TDocument> FirstOrDefaultAsync(Expression<Func<TDocument, bool>> where,
                                 CancellationToken cancellationToken = default);

        Task AddAsync(TSessionHandle session, TDocument logEvent,
                      CancellationToken cancellationToken = default);
    }
}
