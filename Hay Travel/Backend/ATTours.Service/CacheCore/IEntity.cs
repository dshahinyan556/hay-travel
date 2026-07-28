namespace ATTours.BusinessServices.CacheCore
{
    public interface IEntity<TModel>
    {
        Task<TModel> GetEntity();
    }
}
