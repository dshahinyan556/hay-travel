namespace ATTours.Common.DTO.Request
{
    // Назначение исполнителя. LineId == null — bulk-действие "на все строки" (Давид,
    // 2026-08-16: применяется ко всем строкам заказа, каждую можно потом переопределить
    // отдельно); LineId задан — назначение на конкретную строку.
    public class OrderAssignEmployeeModel
    {
        public int OrderId { get; set; }
        public int EmployeeId { get; set; }
        public int? LineId { get; set; }

        // Тихое назначение (Давид, 2026-08-21): попап «Назначить исполнителя» разводит два
        // действия — «Назначить» (без письма) и «Назначить и отправить письмо». Default true,
        // чтобы существующие вызовы, не знающие про поле, сохраняли прежнее поведение.
        public bool SendEmail { get; set; } = true;
    }
}
