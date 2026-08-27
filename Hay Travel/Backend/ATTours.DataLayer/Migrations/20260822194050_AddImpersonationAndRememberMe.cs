using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddImpersonationAndRememberMe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CanImpersonate",
                table: "UserRole",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ImpersonatedByUserId",
                table: "RefreshToken",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RememberMe",
                table: "RefreshToken",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ImpersonationEvent",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ImpersonatorUserId = table.Column<int>(type: "int", nullable: false),
                    TargetUserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IpAddress = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    UserAgent = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImpersonationEvent", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImpersonationEvent_User_ImpersonatorUserId",
                        column: x => x.ImpersonatorUserId,
                        principalTable: "User",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ImpersonationEvent_User_TargetUserId",
                        column: x => x.TargetUserId,
                        principalTable: "User",
                        principalColumn: "Id");
                });

            // Пустые UpdateData по сидовым ролям, которые нагенерил scaffolding (ни одной
            // колонки — сид не изменился, CanImpersonate у всех четырёх и так false =
            // defaultValue новой колонки), удалены намеренно: они разворачиваются в
            // «UPDATE UserRole SET WHERE Id = N» без списка присваиваний.

            migrationBuilder.CreateIndex(
                name: "IX_ImpersonationEvent_ImpersonatorUserId",
                table: "ImpersonationEvent",
                column: "ImpersonatorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ImpersonationEvent_TargetUserId",
                table: "ImpersonationEvent",
                column: "TargetUserId");

            // Сброс живых сессий (spec 014 §4.5, ADR 029) — НАМЕРЕННЫЙ побочный эффект
            // выката, а не случайность. RememberMe у существующих строк и так 0 (defaultValue
            // колонки), а ExpiresAtUtc поджимается до «не позже чем через час»: в течение
            // часа после деплоя вся база проходит через повторный вход и вместе с ним —
            // через свежий резолв прав, вычищая устаревшие claim'ы из старых JWT.
            //
            // 60 минут — дефолт Jwt:InactivityMinutes; в миграции значение зафиксировано
            // литералом сознательно (миграция не читает конфигурацию приложения).
            // Токен, которому и так осталось меньше часа, не продлевается.
            migrationBuilder.Sql(@"
UPDATE [RefreshToken]
SET [RememberMe] = 0,
    [ExpiresAtUtc] = CASE
        WHEN [ExpiresAtUtc] < DATEADD(minute, 60, GETUTCDATE()) THEN [ExpiresAtUtc]
        ELSE DATEADD(minute, 60, GETUTCDATE())
    END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImpersonationEvent");

            migrationBuilder.DropColumn(
                name: "CanImpersonate",
                table: "UserRole");

            migrationBuilder.DropColumn(
                name: "ImpersonatedByUserId",
                table: "RefreshToken");

            migrationBuilder.DropColumn(
                name: "RememberMe",
                table: "RefreshToken");
        }
    }
}
