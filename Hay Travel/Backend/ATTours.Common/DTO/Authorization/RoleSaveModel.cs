namespace ATTours.Common.DTO.Authorization
{
    // Тело POST/PUT api/Roles. Permissions — полная матрица роли: то, чего нет в списке,
    // трактуется как «нет прав» (перезапись целиком, не частичный патч).
    public class RoleSaveModel
    {
        // null (или 0) на создании; PUT берёт id из маршрута, это поле для него необязательно.
        public int? Id { get; set; }

        public string Name { get; set; }

        // Изменение этого поля относительно текущего значения роли требует SuperAdmin —
        // не-SuperAdmin, приславший другое значение, получает 403 (RoleUpdateService/
        // RoleCreationService), а не молчаливый игнор.
        public bool CanManageAdmins { get; set; }

        // Право «войти как пользователь» (spec 014 §2.2). Как и CanManageAdmins: изменение
        // относительно текущего значения роли требует SuperAdmin, иначе 403, а не игнор.
        public bool CanImpersonate { get; set; }

        public List<ScreenPermissionModel> Permissions { get; set; } = [];
    }
}
