using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramNotificationSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "TelegramChatId",
                table: "User",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TelegramUsername",
                table: "User",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            // Один Telegram-чат ↔ один пользователь. Filtered: непривязанные (NULL) строки
            // в индекс не входят, иначе второй же непривязанный пользователь нарушил бы
            // уникальность.
            migrationBuilder.CreateIndex(
                name: "IX_User_TelegramChatId",
                table: "User",
                column: "TelegramChatId",
                unique: true,
                filter: "[TelegramChatId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_User_TelegramChatId",
                table: "User");

            migrationBuilder.DropColumn(
                name: "TelegramChatId",
                table: "User");

            migrationBuilder.DropColumn(
                name: "TelegramUsername",
                table: "User");
        }
    }
}
