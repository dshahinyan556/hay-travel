using ATTours.Common.Enums;

namespace ATTours.BusinessServices.Notifications
{
    // Исполнитель как адресат письма заказа: результат Assign/Unassign и то, во что резолвится
    // order-linked получатель "Исполнитель заказа". Один экземпляр = одно персональное
    // письмо (у каждого свой язык, свои детали и своё PDF-вложение).
    public class OrderEmployeeRecipient
    {
        public int EmployeeId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public EmployeeJobRole EmployeeRole { get; set; }
        public LanguageCode PreferredLanguage { get; set; } = LanguageCode.Russian;

        // Строки заказа, к которым относится ЭТО письмо.
        public List<int> LineIds { get; set; } = [];
    }
}
