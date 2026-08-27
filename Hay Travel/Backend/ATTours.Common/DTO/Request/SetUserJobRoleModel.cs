using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Request
{
    // Рабочая специализация сотрудника по умолчанию (Задача D). null — валидное значение:
    // «снять роль по умолчанию». Настоящий гейт «нельзя назначить без роли» стоит не здесь,
    // а на самом назначении (OrderAssignEmployeeService).
    public class SetUserJobRoleModel
    {
        public int UserId { get; set; }
        public EmployeeJobRole? JobRole { get; set; }
    }
}
