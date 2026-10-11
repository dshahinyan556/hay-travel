using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <summary>
    /// Дописывает блок «Связь с клиентом» в боевые шаблоны заказных писем (спека 016 §5.3).
    /// </summary>
    /// <remarks>
    /// Токен <c>{{ClientContact}}</c> сам по себе ничего не показывает: тела писем лежат в БД и
    /// редактируются админом, поэтому код может лишь ПРЕДОСТАВИТЬ токен — попасть в письмо он
    /// обязан из текста шаблона. Заказчик выбрал вариант «дописываем сами», чтобы после выкладки
    /// контакт был в письмах сразу, без ручной правки шаблонов.
    ///
    /// Идемпотентно (<c>NOT LIKE</c>): повторный прогон не задвоит блок, а админ, уже вставивший
    /// токен руками, не получит второй. Ровно тот же приём, что в
    /// <c>NotificationRecipientsAndBilingualTemplates</c>.
    ///
    /// Только события, которым токен реально выдаётся (<c>EmailPlaceholders.TokensFor</c>):
    /// 1 — OrderCreated, 2 — OrderAssignEmployee, 5 — OrderAutoCancelled. Письму клиенту
    /// (4 — OrderSendToClient) токен не выдаётся: сообщать человеку его же контакты незачем,
    /// и вставленный там литерал отрендерился бы пустотой.
    ///
    /// <c>BodyHtmlEn</c> обновляется ТОЛЬКО когда он непустой: пустой EN означает «перевод не
    /// сделан, письмо уйдёт русской версией» (ADR 026), и дописать в него один английский абзац
    /// значило бы превратить «перевода нет» в «перевод есть и состоит из одной строки».
    /// </remarks>
    public partial class AddClientContactToOrderTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE [EmailTemplate]
                SET [BodyHtml] = [BodyHtml] + N'<p><b>Связь с клиентом:</b></p>{{ClientContact}}'
                WHERE [ActionKey] IN (1, 2, 5)
                  AND [BodyHtml] IS NOT NULL
                  AND [BodyHtml] NOT LIKE N'%{{ClientContact}}%';");

            migrationBuilder.Sql(@"
                UPDATE [EmailTemplate]
                SET [BodyHtmlEn] = [BodyHtmlEn] + N'<p><b>Client contact:</b></p>{{ClientContact}}'
                WHERE [ActionKey] IN (1, 2, 5)
                  AND [BodyHtmlEn] IS NOT NULL
                  AND LTRIM(RTRIM([BodyHtmlEn])) <> N''
                  AND [BodyHtmlEn] NOT LIKE N'%{{ClientContact}}%';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Убираем ровно то, что дописали, — вместе с подписью. Текст, который админ
            // добавил вокруг токена сам, не трогаем: откат миграции не повод терять его работу.
            migrationBuilder.Sql(@"
                UPDATE [EmailTemplate]
                SET [BodyHtml] = REPLACE([BodyHtml], N'<p><b>Связь с клиентом:</b></p>{{ClientContact}}', N'')
                WHERE [ActionKey] IN (1, 2, 5) AND [BodyHtml] IS NOT NULL;");

            migrationBuilder.Sql(@"
                UPDATE [EmailTemplate]
                SET [BodyHtmlEn] = REPLACE([BodyHtmlEn], N'<p><b>Client contact:</b></p>{{ClientContact}}', N'')
                WHERE [ActionKey] IN (1, 2, 5) AND [BodyHtmlEn] IS NOT NULL;");
        }
    }
}
