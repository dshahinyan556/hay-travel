using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddUserIsSuperAdmin : Migration
    {
        // Единственный SuperAdmin (D1-D2, 2026-08-09) — тот же сид-администратор, что заводит
        // SeedAdminUser. Назначается только здесь: эндпоинта «сделать SuperAdmin» нет, роль
        // раздаётся не через UI.
        //
        // Почему UPDATE, а не правка самой SeedAdminUser: та миграция давно применена и на
        // LocalDB, и на проде — переписывание применённой миграции ничего бы не изменило ни
        // в одной существующей базе. UPDATE по Username идемпотентен и безопасен на проде:
        // строка ровно одна, других строк он не трогает.
        private const string AdminUsername = "admin";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSuperAdmin",
                table: "User",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql($"UPDATE [User] SET IsSuperAdmin = 1 WHERE Username = '{AdminUsername}'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSuperAdmin",
                table: "User");
        }
    }
}
