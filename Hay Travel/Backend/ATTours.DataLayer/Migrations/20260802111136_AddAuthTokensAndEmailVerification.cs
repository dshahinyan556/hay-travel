using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddAuthTokensAndEmailVerification : Migration
    {
        // Скаффолдер предлагал DROP TABLE PasswordRecovery + CREATE TABLE UserToken.
        // Переписано на переименование (ADR 006): таблица сейчас пуста, но drop/create
        // сделал бы миграцию невоспроизводимой на любом окружении, где данные появятся
        // раньше наката.

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // --- PasswordRecovery -> UserToken -------------------------------------
            // Констрейнты снимаются до sp_rename: SQL Server переименовывает таблицу,
            // но оставляет старые имена PK/FK, и следующая миграция их бы не нашла.
            migrationBuilder.DropForeignKey(
                name: "FK_PasswordRecovery_User_UserId",
                table: "PasswordRecovery");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PasswordRecovery",
                table: "PasswordRecovery");

            // Уникальность по одному UserId заменяется на (UserId, Type):
            // активных токенов теперь два вида, по одному на назначение.
            migrationBuilder.DropIndex(
                name: "IX_PasswordRecovery_UserId",
                table: "PasswordRecovery");

            migrationBuilder.RenameTable(
                name: "PasswordRecovery",
                newName: "UserToken");

            migrationBuilder.RenameIndex(
                name: "IX_PasswordRecovery_Token",
                table: "UserToken",
                newName: "IX_UserToken_Token");

            // Ранее вся таблица была назначения PasswordReset — значение по умолчанию
            // сохраняет смысл уже существующих строк.
            migrationBuilder.AddColumn<int>(
                name: "Type",
                table: "UserToken",
                type: "int",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserToken",
                table: "UserToken",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_UserToken_UserId_Type",
                table: "UserToken",
                columns: new[] { "UserId", "Type" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_UserToken_User_UserId",
                table: "UserToken",
                column: "UserId",
                principalTable: "User",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // --- User.IsEmailVerified ----------------------------------------------
            migrationBuilder.AddColumn<bool>(
                name: "IsEmailVerified",
                table: "User",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // --- RefreshToken -------------------------------------------------------
            migrationBuilder.CreateTable(
                name: "RefreshToken",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByIp = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    RevokedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReplacedByTokenHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshToken", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshToken_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RefreshToken_TokenHash",
                table: "RefreshToken",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshToken_UserId",
                table: "RefreshToken",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RefreshToken");

            migrationBuilder.DropColumn(
                name: "IsEmailVerified",
                table: "User");

            migrationBuilder.DropForeignKey(
                name: "FK_UserToken_User_UserId",
                table: "UserToken");

            migrationBuilder.DropIndex(
                name: "IX_UserToken_UserId_Type",
                table: "UserToken");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserToken",
                table: "UserToken");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "UserToken");

            migrationBuilder.RenameIndex(
                name: "IX_UserToken_Token",
                table: "UserToken",
                newName: "IX_PasswordRecovery_Token");

            migrationBuilder.RenameTable(
                name: "UserToken",
                newName: "PasswordRecovery");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PasswordRecovery",
                table: "PasswordRecovery",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecovery_UserId",
                table: "PasswordRecovery",
                column: "UserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PasswordRecovery_User_UserId",
                table: "PasswordRecovery",
                column: "UserId",
                principalTable: "User",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
