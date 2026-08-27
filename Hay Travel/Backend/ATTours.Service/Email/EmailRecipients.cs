namespace ATTours.BusinessServices.Email
{
    // Набор адресатов одного письма заказа (редизайн 2026-08-23): получатели настраиваются
    // админом и могут включать копии/скрытые копии, поэтому однополучательской перегрузки
    // IEmailSender стало недостаточно.
    public sealed class EmailAddress
    {
        public string Email { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
    }

    public sealed class EmailRecipients
    {
        public List<EmailAddress> To { get; init; } = [];
        public List<EmailAddress> Cc { get; init; } = [];
        public List<EmailAddress> Bcc { get; init; } = [];
    }
}
