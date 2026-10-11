using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    // Notification Templates (2026-08-31): EmailTemplate (1:1 c ActionKey, только Email)
    // заменяется на открытую библиотеку NotificationTemplate. Порядок ниже — специально НЕ
    // такой, как сгенерировал scaffold (там DropTable EmailTemplate шёл первым и снёс бы
    // данные до переноса): сначала создаём новую схему, переносим данные, и только потом
    // роняем старую таблицу.
    public partial class AddNotificationTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NotificationTemplate",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Channel = table.Column<int>(type: "int", nullable: false),
                    BoundEntity = table.Column<int>(type: "int", nullable: false),
                    Trigger = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    SubjectEn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    BodyHtml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BodyHtmlEn = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CustomCss = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationTemplate", x => x.Id);
                });

            migrationBuilder.AddColumn<int>(
                name: "TemplateId",
                table: "NotificationChannel",
                type: "int",
                nullable: true);

            // ---- Перенос данных: 1 (шаг а) существующие Email-шаблоны событий ----
            // IDENTITY_INSERT: сохраняем те же Id, что были у EmailTemplate — тогда шаг (б)
            // ниже может просто скопировать их напрямую, без join по промежуточному ключу.
            migrationBuilder.Sql(@"
                SET IDENTITY_INSERT NotificationTemplate ON;

                INSERT INTO NotificationTemplate
                    (Id, Name, Description, Channel, BoundEntity, [Trigger], IsActive, Subject, SubjectEn, BodyHtml, BodyHtmlEn, CustomCss)
                SELECT
                    et.Id,
                    N'Email: ' + CAST(et.ActionKey AS nvarchar(10)),
                    NULL,
                    1,      -- NotificationPlatform.Email
                    1,      -- NotificationTemplateEntity.Order
                    0,      -- NotificationTemplateTrigger.None
                    1,
                    et.Subject,
                    et.SubjectEn,
                    et.BodyHtml,
                    et.BodyHtmlEn,
                    NULL
                FROM EmailTemplate et;

                SET IDENTITY_INSERT NotificationTemplate OFF;
            ");

            // ---- Перенос данных: 2 (шаг б) привязка перенесённых шаблонов к каналу ----
            // Тот же Id, что был у EmailTemplate.Id (шаг а гарантирует совпадение) — join
            // по ActionKey/EventKey нужен только чтобы найти СТРОКУ канала, само значение
            // TemplateId берём готовым (et.Id).
            migrationBuilder.Sql(@"
                UPDATE nc
                SET nc.TemplateId = et.Id
                FROM NotificationChannel nc
                JOIN EmailTemplate et ON et.ActionKey = nc.EventKey
                WHERE nc.Platform = 1; -- NotificationPlatform.Email
            ");

            // ---- Перенос данных: 3 — Telegram ЭТИХ ЖЕ 5 событий ----
            // Раньше Telegram-текст этих событий строил код (OrderNotificationService.
            // Telegram.cs, BuildTelegramText) — шаблона в БД не было вовсе. Теперь заводим
            // по шаблону на событие (Channel=Telegram) и привязываем ко всем существующим
            // строкам канала Platform=Telegram (какие есть — включённым и выключенным
            // одинаково: у выключенных это просто готовит почву на будущее, у включённых —
            // не даёт отправке замолчать после этой миграции). Разметка — Telegram-safe
            // (только <b>, без <p>/<br>: перенос строки — литеральный \n). EN не заполнен
            // (фолбэк на RU, как у остальных билингвальных шаблонов) — переведёт админ.
            migrationBuilder.Sql(@"
                INSERT INTO NotificationTemplate
                    (Name, Description, Channel, BoundEntity, [Trigger], IsActive, Subject, SubjectEn, BodyHtml, BodyHtmlEn, CustomCss)
                VALUES
                    (N'Telegram: 1', N'Автосоздано миграцией 2026-08-31 — проверьте текст.', 2, 1, 0, 1, NULL, NULL,
                        N'<b>{{EventTitle}}</b>' + CHAR(10) + N'Заказ №{{OrderNumber}}' + CHAR(10) + N'{{OrderLines}}' + CHAR(10) + N'{{ClientContact}}', NULL, NULL),
                    (N'Telegram: 2', N'Автосоздано миграцией 2026-08-31 — проверьте текст.', 2, 1, 0, 1, NULL, NULL,
                        N'<b>{{EventTitle}}</b>' + CHAR(10) + N'Заказ №{{OrderNumber}}' + CHAR(10) + N'Исполнитель: {{EmployeeName}} ({{EmployeeRole}})' + CHAR(10) + N'{{AssignmentDetails}}' + CHAR(10) + N'{{ClientContact}}', NULL, NULL),
                    (N'Telegram: 3', N'Автосоздано миграцией 2026-08-31 — проверьте текст.', 2, 1, 0, 1, NULL, NULL,
                        N'<b>{{EventTitle}}</b>' + CHAR(10) + N'Заказ №{{OrderNumber}}' + CHAR(10) + N'Исполнитель: {{EmployeeName}} ({{EmployeeRole}})', NULL, NULL),
                    (N'Telegram: 4', N'Автосоздано миграцией 2026-08-31 — проверьте текст.', 2, 1, 0, 1, NULL, NULL,
                        N'<b>{{EventTitle}}</b>' + CHAR(10) + N'Заказ №{{OrderNumber}}', NULL, NULL),
                    (N'Telegram: 5', N'Автосоздано миграцией 2026-08-31 — проверьте текст.', 2, 1, 0, 1, NULL, NULL,
                        N'<b>{{EventTitle}}</b>' + CHAR(10) + N'Заказ №{{OrderNumber}}' + CHAR(10) + N'{{OrderLines}}' + CHAR(10) + N'{{ClientContact}}', NULL, NULL);

                UPDATE nc
                SET nc.TemplateId = nt.Id
                FROM NotificationChannel nc
                JOIN NotificationTemplate nt
                    ON nt.Channel = 2 AND nt.Name = N'Telegram: ' + CAST(nc.EventKey AS nvarchar(10))
                WHERE nc.Platform = 2; -- NotificationPlatform.Telegram
            ");

            // ---- Перенос данных: 4 — 4 auth-письма из EmailMessageFactory.cs ----
            // Обычные (не системные) шаблоны — Давид явно поправил это на этапе обсуждения.
            // Trigger — единственное, что говорит AuthService, какой шаблон использовать.
            // Текст — 1:1 из EmailMessageFactory (Subject*/BuildXxxBody), просто обёрнут в
            // <p> и с {{Token}} вместо интерполированных значений. EN не заполнен.
            migrationBuilder.Sql(@"
                INSERT INTO NotificationTemplate
                    (Name, Description, Channel, BoundEntity, [Trigger], IsActive, Subject, SubjectEn, BodyHtml, BodyHtmlEn, CustomCss)
                VALUES
                    (N'Подтверждение регистрации', N'Auth: письмо со ссылкой подтверждения email при регистрации.', 1, 0, 1, 1,
                        N'Подтверждение регистрации — Hay Travel', NULL,
                        N'<p>Здравствуйте, {{UserName}}!</p><p>Чтобы завершить регистрацию, подтвердите адрес почты: {{VerifyUrl}}</p><p>Ссылка действует 1 час. Если вы не регистрировались, просто проигнорируйте это письмо.</p>', NULL, NULL),
                    (N'Восстановление пароля', N'Auth: письмо со ссылкой сброса пароля.', 1, 0, 2, 1,
                        N'Восстановление пароля — Hay Travel', NULL,
                        N'<p>Здравствуйте, {{UserName}}!</p><p>Для смены пароля перейдите по ссылке: {{ResetUrl}}</p><p>Ссылка действует 1 час. Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.</p>', NULL, NULL),
                    (N'Код смены почты', N'Auth: письмо с кодом подтверждения на СТАРЫЙ адрес при смене почты.', 1, 0, 3, 1,
                        N'Код подтверждения смены почты — Hay Travel', NULL,
                        N'<p>Здравствуйте, {{UserName}}!</p><p>Код подтверждения для смены адреса почты: {{Code}}</p><p>Код действует 15 минут. Если вы не запрашивали смену почты, просто проигнорируйте это письмо.</p>', NULL, NULL),
                    (N'Подтверждение новой почты', N'Auth: письмо со ссылкой подтверждения на НОВЫЙ адрес при смене почты.', 1, 0, 4, 1,
                        N'Подтверждение нового адреса почты — Hay Travel', NULL,
                        N'<p>Здравствуйте, {{UserName}}!</p><p>Чтобы подтвердить новый адрес почты, перейдите по ссылке: {{ConfirmUrl}}</p><p>Ссылка действует 1 час. Если вы не запрашивали смену почты, просто проигнорируйте это письмо.</p>', NULL, NULL);
            ");

            // ---- Старая таблица — теперь безопасно уронить, данные уже перенесены ----
            migrationBuilder.DropTable(
                name: "EmailTemplate");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationChannel_TemplateId",
                table: "NotificationChannel",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationTemplate_Trigger",
                table: "NotificationTemplate",
                column: "Trigger",
                unique: true,
                filter: "[Trigger] <> 0");

            migrationBuilder.AddForeignKey(
                name: "FK_NotificationChannel_NotificationTemplate_TemplateId",
                table: "NotificationChannel",
                column: "TemplateId",
                principalTable: "NotificationTemplate",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_NotificationChannel_NotificationTemplate_TemplateId",
                table: "NotificationChannel");

            migrationBuilder.CreateTable(
                name: "EmailTemplate",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ActionKey = table.Column<int>(type: "int", nullable: false),
                    BodyHtml = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BodyHtmlEn = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Subject = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SubjectEn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailTemplate", x => x.Id);
                });

            // Откат данных: только Email-шаблоны 5 событий (Telegram/auth-шаблонов у старой
            // схемы не было — их некуда откатывать, они просто пропадут вместе с таблицей).
            migrationBuilder.Sql(@"
                SET IDENTITY_INSERT EmailTemplate ON;

                INSERT INTO EmailTemplate (Id, ActionKey, Subject, SubjectEn, BodyHtml, BodyHtmlEn)
                SELECT nt.Id, nc.EventKey, nt.Subject, nt.SubjectEn, nt.BodyHtml, nt.BodyHtmlEn
                FROM NotificationTemplate nt
                JOIN NotificationChannel nc ON nc.TemplateId = nt.Id AND nc.Platform = 1
                WHERE nt.Channel = 1 AND nt.[Trigger] = 0;

                SET IDENTITY_INSERT EmailTemplate OFF;
            ");

            migrationBuilder.DropTable(
                name: "NotificationTemplate");

            migrationBuilder.CreateIndex(
                name: "IX_EmailTemplate_ActionKey",
                table: "EmailTemplate",
                column: "ActionKey",
                unique: true);

            migrationBuilder.DropIndex(
                name: "IX_NotificationChannel_TemplateId",
                table: "NotificationChannel");

            migrationBuilder.DropColumn(
                name: "TemplateId",
                table: "NotificationChannel");
        }
    }
}
