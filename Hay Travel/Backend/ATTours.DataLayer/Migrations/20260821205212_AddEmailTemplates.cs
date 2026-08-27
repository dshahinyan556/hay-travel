using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmailTemplate",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ActionKey = table.Column<int>(type: "int", nullable: false),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    BodyHtml = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailTemplate", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmailTemplate_ActionKey",
                table: "EmailTemplate",
                column: "ActionKey",
                unique: true);

            // Сид всех 4 шаблонов (Задача E, §E.10). Благодаря ему EmailTemplateInfo читает
            // только БД и не сливает её с каталогом в коде (в отличие от SiteSetting), а
            // notification-сервису не приходится держать «дефолтный текст на случай, если
            // строки нет». Тексты — HTML-версии писем, которые до этого были зашиты в
            // EmailMessageFactory (order-билдеры оттуда удалены).
            //
            // IsEnabled = true у всех: до Задачи E все три существовавших письма уходили
            // безусловно, и миграция не должна менять поведение прода.
            migrationBuilder.InsertData(
                table: "EmailTemplate",
                columns: new[] { "Id", "ActionKey", "IsEnabled", "Subject", "BodyHtml" },
                values: new object[,]
                {
                    {
                        1, 1, true,
                        "Новая заявка на бронь — Hay Travel",
                        "<p>Новая заявка ждёт подтверждения в админке.</p>" +
                        "<p>Заказ № {{OrderNumber}}<br>Тур: {{TourTitle}}<br>Дата: {{TourDate}}<br>" +
                        "Гостей: {{GuestCount}}<br>Клиент: {{ClientName}} ({{ClientEmail}})</p>" +
                        "<p>Подтвердите или отмените заявку в разделе «Заказы» админ-панели.</p>"
                    },
                    {
                        2, 2, true,
                        "Назначение по заказу № {{OrderNumber}} — Hay Travel",
                        "<p>Здравствуйте, {{EmployeeName}}!</p>" +
                        "<p>Вам назначен заказ № {{OrderNumber}}. Ваша роль: {{EmployeeRole}}.</p>" +
                        "{{AssignmentDetails}}" +
                        "<p>Полная информация — во вложенном PDF.</p>"
                    },
                    {
                        3, 3, true,
                        "Отмена назначения по заказу № {{OrderNumber}} — Hay Travel",
                        "<p>Здравствуйте, {{EmployeeName}}!</p>" +
                        "<p>С вас снято назначение по заказу № {{OrderNumber}} (роль: {{EmployeeRole}}).</p>" +
                        "<p>Если это ошибка, свяжитесь с администратором.</p>"
                    },
                    {
                        4, 4, true,
                        "Заказ № {{OrderNumber}} — Hay Travel",
                        "<p>Здравствуйте, {{ClientName}}!</p>" +
                        "<p>Во вложении — документ по заказу № {{OrderNumber}}.</p>" +
                        "<p>Если у вас есть вопросы по заказу, ответьте на это письмо.</p>"
                    }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Строки уезжают вместе с таблицей, отдельный DeleteData не нужен.
            migrationBuilder.DropTable(
                name: "EmailTemplate");
        }
    }
}
