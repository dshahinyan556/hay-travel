namespace ATTours.BusinessServices.Core.Info
{
    public interface IEntityInfoBase<TEntity> 
    {
        Task<List<TEntity>> GetAllAsync();
    }
}
