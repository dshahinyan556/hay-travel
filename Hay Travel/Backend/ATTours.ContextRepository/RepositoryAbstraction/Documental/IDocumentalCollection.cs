using System.Linq.Expressions;

namespace ATTours.ContextRepository.RepositoryAbstraction.Documental
{
    public interface IDocumentalCollection<TDocument, TSessionHandle>
    {
        Task InsertOneAsync(TDocument document, CancellationToken cancellationToken = default);
        Task InsertOneAsync(TSessionHandle session, TDocument document, CancellationToken cancellationToken = default);
        Task<TDocument> FindOneAndUpdateAsync<TField>(Expression<Func<TDocument, bool>> filter, Expression<Func<TDocument, TField>> field, TField value, CancellationToken cancellationToken = default);
        Task<TDocument> FindOneAndUpdateAsync<TField>(TSessionHandle session, Expression<Func<TDocument, bool>> filter, Expression<Func<TDocument, TField>> field, TField value, CancellationToken cancellationToken = default);
        Task<TDocument> FirstOrDefaultAsync(Expression<Func<TDocument, bool>> filter, CancellationToken cancellationToken = default);
        Task<List<TDocument>> ToListAsync(Expression<Func<TDocument, bool>> filter, CancellationToken cancellationToken = default);
    }
}
