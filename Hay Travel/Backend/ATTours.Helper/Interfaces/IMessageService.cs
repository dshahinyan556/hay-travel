namespace ATTours.Helper.Interfaces
{
    public interface IMessageService
    {
        Task<string> GetMessageAsync(Enum messageCode);
    }
}
