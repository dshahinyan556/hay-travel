namespace ATTours.Common.DTO.Request
{
    // Тело PATCH SetArchived: архивировать (true) или восстановить (false) тур.
    public class SetTourArchivedModel
    {
        public int Id { get; set; }
        public bool IsArchived { get; set; }
    }
}
