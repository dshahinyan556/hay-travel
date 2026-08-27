using ATTours.Common.DTO.Info;

namespace ATTours.BusinessServices.Notifications
{
    // Единственное место, где принимается решение «слать письмо заказа и кому именно»
    // (редизайн 2026-08-23): рубильник канала (NotificationChannel.IsEnabled) и состав
    // получателей (NotificationRecipient) читаются здесь, а не в контроллере.
    //
    // Контроллер решает только «есть ли намерение отправить» (OrderAssignEmployeeModel.SendEmail);
    // письмо уходит ⟺ намерение И включённый канал И хотя бы один резолвнутый получатель.
    //
    // PDF собирает сам сервис: вложение перестало быть одним на вызов — оно зависит от того,
    // кому уходит конкретное письмо (персональное задание исполнителю ≠ документ заказа).
    public interface IOrderNotificationService
    {
        Task SendOrderCreatedAsync(OrderInfoModel order, CancellationToken cancellationToken = default);

        // assigned — исполнители, назначенные ЭТИМ вызовом (OrderAssignEmployeeResult.Assigned):
        // из заказа их не вывести, письмо не должно уйти всем, кто был на нём раньше.
        Task SendAssignmentAsync(OrderInfoModel order, IReadOnlyCollection<OrderEmployeeRecipient> assigned,
            CancellationToken cancellationToken = default);

        // unassigned — снятые ЭТИМ вызовом (данные захвачены до удаления: в строках их уже нет).
        Task SendUnassignmentAsync(OrderInfoModel order, IReadOnlyCollection<OrderEmployeeRecipient> unassigned,
            CancellationToken cancellationToken = default);

        Task SendOrderDocumentAsync(OrderInfoModel order, CancellationToken cancellationToken = default);
    }
}
