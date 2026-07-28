using ATTours.ContextRepository.RepositoryAbstraction.Documental;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ATTours.ContextRepository.ContextAbstraction
{
    public interface IDocumentalContext<TSessionHandle>
    {
        IDocumentalCollection<TEntity, TSessionHandle> GetCollection<TEntity>(string collectionName);
        Task<TSessionHandle> StartSessionAsync();
    }
}
