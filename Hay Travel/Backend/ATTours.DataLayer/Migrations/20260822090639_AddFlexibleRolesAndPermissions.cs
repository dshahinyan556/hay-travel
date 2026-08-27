using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddFlexibleRolesAndPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Description",
                table: "UserRole",
                newName: "Name");

            migrationBuilder.AlterColumn<int>(
                name: "Type",
                table: "UserRole",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<bool>(
                name: "IsSystem",
                table: "UserRole",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "RolePermission",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    ScreenKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    // Уровень доступа (AccessLevel): 0 = None ... 4 = Delete, каждый включает
                    // всё, что ниже (ADR 027). Миграция правлена ДО деплоя — четырёх
                    // независимых bit-колонок в БД не существовало ни разу (spec 014 §1.11).
                    Level = table.Column<int>(type: "int", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermission", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RolePermission_UserRole_RoleId",
                        column: x => x.RoleId,
                        principalTable: "UserRole",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserPermissionOverride",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ScreenKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    // NULL = «наследовать от роли»; значение перекрывает уровень роли в обе
                    // стороны, включая 0 (None) — явный запрет поверх роли.
                    Level = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPermissionOverride", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPermissionOverride_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

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
                keyValue: 3,
                column: "IsSystem",
                value: true);

            migrationBuilder.UpdateData(
                table: "UserRole",
                keyColumn: "Id",
                keyValue: 4,
                column: "IsSystem",
                value: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserRole_Name",
                table: "UserRole",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RolePermission_RoleId_ScreenKey",
                table: "RolePermission",
                columns: new[] { "RoleId", "ScreenKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserPermissionOverride_UserId_ScreenKey",
                table: "UserPermissionOverride",
                columns: new[] { "UserId", "ScreenKey" },
                unique: true);

            // Сид матрицы прав системных ролей (architecture-flexible-roles.md §1.5): строки
            // 1:1 воспроизводят гейтинг, который до этой миграции был зашит в
            // [Authorize(Roles=...)] на контроллерах — переход не меняет поведение ни одной
            // из существующих ролей.
            //
            // InsertData, а не HasData: матрица правится из UI, и HasData при каждой
            // последующей миграции пытался бы вернуть её к сидовому состоянию.
            //
            // Regular (1) и Employee (4) строк не получают: в админку они не ходят, а
            // Employee работает через свой жёсткий [Authorize(Roles=Employee)]-эндпоинт.
            // Admin (3) резолвер и так пускает всюду безусловно — строки заведены, чтобы
            // его матрица отображалась в UI заполненной, а не пустой.
            //
            // Level — уровень из AccessLevel: 1=View, 2=Create, 3=Update, 4=Delete, каждый
            // включает всё, что ниже. Значение всегда РАВНО одному из применимых к экрану
            // действий (AdminScreens.Actions), иначе резолвер обрежет его CapLevel'ом.
            migrationBuilder.InsertData(
                table: "RolePermission",
                columns: new[] { "Id", "RoleId", "ScreenKey", "Level" },
                values: new object[,]
                {
                    // --- TourManager (RoleId 2): ведёт контент туров, справочники читает ---
                    {  1, 2, "dashboard",                  1 },
                    // Update включает Create — ровно то, что раньше давали флаги V+C+U.
                    {  2, 2, "products",                   3 },
                    {  3, 2, "catalog.places",             1 },
                    {  4, 2, "catalog.expense-templates",  1 },
                    {  5, 2, "catalog.note-templates",     1 },
                    {  6, 2, "catalog.regions",            1 },
                    {  7, 2, "catalog.tags",               1 },

                    // --- Admin (RoleId 3): максимум, применимый к экрану ---
                    {  8, 3, "dashboard",                  1 },
                    {  9, 3, "products",                   4 },
                    // У календаря нет Update: правка правила = удалить + создать (ADR 012).
                    // Delete (4) как уровень покрывает и View, и Create; несуществующий
                    // Update экрана от этого не появляется — его нет в реестре действий.
                    { 10, 3, "calendar",                   4 },
                    { 11, 3, "orders",                     4 },
                    { 12, 3, "catalog.places",             4 },
                    { 13, 3, "catalog.expense-templates",  4 },
                    { 14, 3, "catalog.note-templates",     4 },
                    // Набор регионов фиксирован сидом — правится только тизер (максимум Update).
                    { 15, 3, "catalog.regions",            3 },
                    { 16, 3, "catalog.tags",               4 },
                    // Create нет: пользователи регистрируются сами; максимум — Delete.
                    { 17, 3, "users",                      4 },
                    // Состав ключей настроек фиксирован каталогом в коде (ADR 002).
                    { 18, 3, "settings",                   3 }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Сидовые строки RolePermission отдельно не удаляются — их уносит DropTable.
            migrationBuilder.DropTable(
                name: "RolePermission");

            migrationBuilder.DropTable(
                name: "UserPermissionOverride");

            migrationBuilder.DropIndex(
                name: "IX_UserRole_Name",
                table: "UserRole");

            migrationBuilder.DropColumn(
                name: "IsSystem",
                table: "UserRole");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "UserRole",
                newName: "Description");

            migrationBuilder.AlterColumn<int>(
                name: "Type",
                table: "UserRole",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
