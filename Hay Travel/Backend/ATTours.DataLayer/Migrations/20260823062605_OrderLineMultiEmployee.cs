using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    // Мульти-исполнители на строке заказа (редизайн 2026-08-23): плоские
    // OrderLine.EmployeeId/EmployeeRole/PickupDetails/NavigatorLink заменяются join-таблицей
    // OrderLineEmployee, где у каждого исполнителя своя роль и свои "детали для выполнения".
    //
    // Порядок операций важен: таблица создаётся и наполняется ДО удаления колонок-источников.
    public partial class OrderLineMultiEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrderLineEmployee",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderLineId = table.Column<int>(type: "int", nullable: false),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    EmployeeRole = table.Column<int>(type: "int", nullable: false),
                    PickupDetails = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NavigatorLink = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CommentEn = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderLineEmployee", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderLineEmployee_OrderLine_OrderLineId",
                        column: x => x.OrderLineId,
                        principalTable: "OrderLine",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderLineEmployee_User_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderLineEmployee_EmployeeId",
                table: "OrderLineEmployee",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderLineEmployee_OrderLineId_EmployeeId",
                table: "OrderLineEmployee",
                columns: new[] { "OrderLineId", "EmployeeId" },
                unique: true);

            // Перенос данных: по одной строке назначения на каждую существующую непустую связку.
            // ISNULL(EmployeeRole, 3) = DriverGuide — строки, назначенные до Задачи D, роли не
            // имеют, а на новой сущности она non-nullable. DriverGuide — самая широкая роль:
            // она не сужает то, что человек фактически делал, тогда как Driver/Guide могли бы
            // соврать.
            migrationBuilder.Sql(@"
                INSERT INTO [OrderLineEmployee] ([OrderLineId], [EmployeeId], [EmployeeRole], [PickupDetails], [NavigatorLink], [Comment], [CommentEn])
                SELECT [Id], [EmployeeId], ISNULL([EmployeeRole], 3), [PickupDetails], [NavigatorLink], NULL, NULL
                FROM [OrderLine]
                WHERE [EmployeeId] IS NOT NULL;");

            // «Осиротевшие» детали — строки без исполнителя, но с заполненным местом встречи
            // или навигатором. В новой модели адресовать их некому, но молча стирать введённые
            // админом данные нельзя, поэтому они уезжают текстом в журнал заказа (Type = 6,
            // OrderEventType.LineUpdated) — уже существующую read-only ленту таба «История».
            migrationBuilder.Sql(@"
                INSERT INTO [OrderEvent] ([OrderId], [Type], [Description], [ActorUserId], [ActorFullName], [CreatedAtUtc])
                SELECT [OrderId], 6,
                       N'Переход на мульти-исполнителей: детали строки без исполнителя не перенесены. '
                       + ISNULL(N'Место встречи: ' + [PickupDetails] + N'. ', N'')
                       + ISNULL(N'Навигатор: ' + [NavigatorLink], N''),
                       NULL, NULL, GETUTCDATE()
                FROM [OrderLine]
                WHERE [EmployeeId] IS NULL
                  AND (NULLIF(LTRIM(RTRIM(ISNULL([PickupDetails], N''))), N'') IS NOT NULL
                    OR NULLIF(LTRIM(RTRIM(ISNULL([NavigatorLink], N''))), N'') IS NOT NULL);");

            migrationBuilder.DropForeignKey(
                name: "FK_OrderLine_User_EmployeeId",
                table: "OrderLine");

            migrationBuilder.DropIndex(
                name: "IX_OrderLine_EmployeeId",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "EmployeeRole",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "NavigatorLink",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "PickupDetails",
                table: "OrderLine");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EmployeeId",
                table: "OrderLine",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EmployeeRole",
                table: "OrderLine",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NavigatorLink",
                table: "OrderLine",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PickupDetails",
                table: "OrderLine",
                type: "nvarchar(max)",
                nullable: true);

            // Обратный перенос: на строку заказа возвращается ОДИН исполнитель — первый по Id.
            // Если их было несколько, остальные при откате теряются: старая схема второго
            // исполнителя хранить не умеет. Это ожидаемая и осознанная потеря.
            migrationBuilder.Sql(@"
                UPDATE line
                SET line.[EmployeeId] = first.[EmployeeId],
                    line.[EmployeeRole] = first.[EmployeeRole],
                    line.[PickupDetails] = first.[PickupDetails],
                    line.[NavigatorLink] = first.[NavigatorLink]
                FROM [OrderLine] AS line
                INNER JOIN (
                    SELECT assignment.*
                    FROM [OrderLineEmployee] AS assignment
                    INNER JOIN (
                        SELECT [OrderLineId], MIN([Id]) AS [Id]
                        FROM [OrderLineEmployee]
                        GROUP BY [OrderLineId]
                    ) AS earliest ON earliest.[Id] = assignment.[Id]
                ) AS first ON first.[OrderLineId] = line.[Id];");

            migrationBuilder.CreateIndex(
                name: "IX_OrderLine_EmployeeId",
                table: "OrderLine",
                column: "EmployeeId");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderLine_User_EmployeeId",
                table: "OrderLine",
                column: "EmployeeId",
                principalTable: "User",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropTable(
                name: "OrderLineEmployee");
        }
    }
}
