using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    // Настраиваемые получатели уведомлений + билингвальные шаблоны (редизайн 2026-08-23).
    //
    // Порядок операций важен: каналы засеиваются ИЗ EmailTemplate.IsEnabled, поэтому эта
    // колонка удаляется последним шагом.
    public partial class NotificationRecipientsAndBilingualTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // defaultValue: 1 = LanguageCode.Russian — существующие пользователи получают
            // текущее фактическое поведение (письма на русском), а не значение вне enum.
            migrationBuilder.AddColumn<int>(
                name: "PreferredLanguage",
                table: "User",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "SubjectEn",
                table: "EmailTemplate",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BodyHtmlEn",
                table: "EmailTemplate",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "NotificationChannel",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EventKey = table.Column<int>(type: "int", nullable: false),
                    Platform = table.Column<int>(type: "int", nullable: false),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationChannel", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NotificationRecipient",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EventKey = table.Column<int>(type: "int", nullable: false),
                    Platform = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: true),
                    SourceType = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    OrderLinkedRole = table.Column<int>(type: "int", nullable: true),
                    CustomEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationRecipient", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationRecipient_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationChannel_EventKey_Platform",
                table: "NotificationChannel",
                columns: new[] { "EventKey", "Platform" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NotificationRecipient_EventKey_Platform",
                table: "NotificationRecipient",
                columns: new[] { "EventKey", "Platform" });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationRecipient_UserId",
                table: "NotificationRecipient",
                column: "UserId");

            // Сид каналов. Email-канал наследует текущий тумблер шаблона, чтобы выключенное
            // админом осталось выключенным; Telegram выключен — реальной отправки нет.
            migrationBuilder.Sql(@"
                INSERT INTO [NotificationChannel] ([EventKey], [Platform], [IsEnabled])
                SELECT [ActionKey], 1, [IsEnabled] FROM [EmailTemplate];");

            migrationBuilder.Sql(@"
                INSERT INTO [NotificationChannel] ([EventKey], [Platform], [IsEnabled])
                SELECT [ActionKey], 2, 0 FROM [EmailTemplate];");

            // Сид получателей — РОВНО текущий зашитый в код набор, чтобы поведение не
            // изменилось молча:
            //   OrderCreated          -> AdminMailbox (был emailSettings.AdminNotificationEmail)
            //   OrderAssignEmployee   -> OrderLinked/Employee (был параметр employeeEmail)
            //   OrderUnassignEmployee -> OrderLinked/Employee (был параметр employeeEmail)
            //   OrderSendToClient     -> OrderLinked/Client   (был order.UserEmail)
            //
            // AdminMailbox, а не CustomEmail с явным адресом: Email:AdminNotificationEmail
            // не задан в appsettings и падает в фолбэк FromEmail, который в prod и dev разный —
            // захардкодить один адрес значило бы изменить поведение в одной из сред.
            // Telegram-получателей не сидим: канал выключен, отправки нет.
            migrationBuilder.InsertData(
                table: "NotificationRecipient",
                columns: new[] { "EventKey", "Platform", "IsActive", "Type", "SourceType", "UserId", "OrderLinkedRole", "CustomEmail", "SortOrder" },
                values: new object[,]
                {
                    { 1, 1, true, 1, 4, null, null, null, 0 },
                    { 2, 1, true, 1, 2, null, 2, null, 0 },
                    { 3, 1, true, 1, 2, null, 2, null, 0 },
                    { 4, 1, true, 1, 2, null, 1, null, 0 }
                });

            // Последним шагом: сид каналов выше читает эту колонку.
            migrationBuilder.DropColumn(
                name: "IsEnabled",
                table: "EmailTemplate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsEnabled",
                table: "EmailTemplate",
                type: "bit",
                nullable: false,
                defaultValue: true);

            // Возврат тумблера из Email-канала: иначе откат включил бы все письма разом.
            migrationBuilder.Sql(@"
                UPDATE template
                SET template.[IsEnabled] = channel.[IsEnabled]
                FROM [EmailTemplate] AS template
                INNER JOIN [NotificationChannel] AS channel
                    ON channel.[EventKey] = template.[ActionKey] AND channel.[Platform] = 1;");

            migrationBuilder.DropTable(
                name: "NotificationRecipient");

            migrationBuilder.DropTable(
                name: "NotificationChannel");

            migrationBuilder.DropColumn(
                name: "PreferredLanguage",
                table: "User");

            migrationBuilder.DropColumn(
                name: "SubjectEn",
                table: "EmailTemplate");

            migrationBuilder.DropColumn(
                name: "BodyHtmlEn",
                table: "EmailTemplate");
        }
    }
}
