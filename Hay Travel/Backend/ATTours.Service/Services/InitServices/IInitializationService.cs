namespace ATTours.BusinessServices.Services.InitServices
{
    public interface IInitializationService<TInitModel>
        where TInitModel : class
    {
        Task<TInitModel> InitAsync();
    }
}
