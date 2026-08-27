using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    // Гибкая система ролей и прав, часть 2 (решение Давида 2026-08-22): ни одна роль
    // (включая сидовую «Администратор») больше не защищена от переименования, удаления
    // или правки матрицы. IsSystem переименован в CanManageAdmins — новый ролевой (не
    // per-экранный) флаг «может трогать других носителей этого же флага», который умеет
    // ставить/снимать только SuperAdmin. Ровно та же строка (Id 3), что раньше имела
    // IsSystem=true, получает CanManageAdmins=true — поведение сразу после миграции не
    // меняется, дальше матрицу и сам этот флаг можно свободно редактировать из UI.
    //
    // Заодно — Roles/Screens/EmailTemplate перестают быть жёстко зашитыми Admin-only
    // мета-экранами и становятся обычными ключами матрицы (roles/notifications):
    // сидуем права на них для RoleId 3 (Admin) один в один с тем, что раньше давал
    // [Authorize(Roles=Admin)] безусловно; остальным ролям — как и раньше, ничего.
    /// <inheritdoc />
    public partial class RemoveRoleSystemLockAddCanManageAdmins : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "IsSystem",
                table: "UserRole",
                newName: "CanManageAdmins");

            migrationBuilder.UpdateData(
                table: "UserRole",
                keyColumn: "Id",
                keyValue: 1,
                column: "CanManageAdmins",
                value: false);

            migrationBuilder.UpdateData(
                table: "UserRole",
                keyColumn: "Id",
                keyValue: 2,
                column: "CanManageAdmins",
                value: false);

            migrationBuilder.UpdateData(
                table: "UserRole",
                keyColumn: "Id",
                keyValue: 4,
                column: "CanManageAdmins",
                value: false);

            // Level — уровень AccessLevel (1=View..4=Delete), см. предыдущую миграцию.
            migrationBuilder.InsertData(
                table: "RolePermission",
                columns: new[] { "Id", "RoleId", "ScreenKey", "Level" },
                values: new object[,]
                {
                    // --- Admin (RoleId 3): новые мета-экраны, promoted в матрицу ---
                    { 19, 3, "roles",         4 },
                    // У уведомлений применимы только View/Update — максимум Update.
                    { 20, 3, "notifications", 3 }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "RolePermission",
                keyColumn: "Id",
                keyValues: new object[] { 19, 20 });

            migrationBuilder.RenameColumn(
                name: "CanManageAdmins",
                table: "UserRole",
                newName: "IsSystem");

            migrationBuilder.UpdateData(
                table: "UserRole",
                keyColumn: "Id",
                keyValue: 1,
                column: "IsSystem",
                value: true);

            migrationBuilder.UpdateData(
                table: "UserRole",
                keyColumn: "Id",
                keyValue: 2,
                column: "IsSystem",
                value: true);

            migrationBuilder.UpdateData(
                table: "UserRole",
                keyColumn: "Id",
                keyValue: 4,
                column: "IsSystem",
                value: true);
        }
    }
}
