using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Каналы уведомлений: NOT NULL, и таблица User на момент миграции НЕ пуста —
            // defaultValue обязателен, иначе ALTER не пройдёт. 1 = NotificationChannelFlags.Email,
            // то есть текущее фактическое поведение рассылки для всех существующих аккаунтов.
            // Дефолт живёт только здесь, а не в UserConfiguration — как и у PreferredLanguage
            // (см. комментарий там).
            migrationBuilder.AddColumn<int>(
                name: "NotificationChannels",
                table: "User",
                type: "int",
                nullable: false,
                defaultValue: 1);

            // Три поля ниже НУЛЛАБЕЛЬНЫЕ и дефолта не получают намеренно: NULL здесь значит
            // «личного выбора нет, брать дефолт сайта». Проставить им значения — значит
            // навсегда отвязать существующих пользователей от админской смены
            // theme.defaultMode/theme.activePalette.

            migrationBuilder.AddColumn<string>(
                name: "PreferredCurrency",
                table: "User",
                type: "nchar(3)",
                fixedLength: true,
                maxLength: 3,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredPalette",
                table: "User",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredTheme",
                table: "User",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotificationChannels",
                table: "User");

            migrationBuilder.DropColumn(
                name: "PreferredCurrency",
                table: "User");

            migrationBuilder.DropColumn(
                name: "PreferredPalette",
                table: "User");

            migrationBuilder.DropColumn(
                name: "PreferredTheme",
                table: "User");
        }
    }
}
