using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    // Батч «Трансферы + формат продукта + время старта» (checklist-transfers-format-2026-08-29,
    // Фаза 1). Схема: трансфер как третий TourType, формат тура (индивидуальный/групповой),
    // коллекция времён старта, справочник классов авто с ценами трансфера, кастомная заявка
    // на строке заказа. Бизнес-логика (валидация, расчёт цены, эндпоинты) — Фаза 2.
    public partial class AddTransfersProductFormatAndStartTimes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Format",
                table: "Tour",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GroupCapacity",
                table: "Tour",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "GroupPricePerPerson",
                table: "Tour",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TourId",
                table: "OrderLine",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "Format",
                table: "OrderLine",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRoundTrip",
                table: "OrderLine",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // defaultValue: 1 = OrderLineKind.Product — все уже существующие строки заказов
            // это брони продукта из каталога (кастомных заявок до этого батча не было).
            // Числом, а не через enum: миграция — снимок прошлого, переименование члена enum'а
            // не должно менять уже применённый к проду скрипт.
            migrationBuilder.AddColumn<int>(
                name: "LineKind",
                table: "OrderLine",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ReturnDate",
                table: "OrderLine",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "ReturnTime",
                table: "OrderLine",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "StartTime",
                table: "OrderLine",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VehicleClassId",
                table: "OrderLine",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VehicleClassNameSnapshot",
                table: "OrderLine",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TourStartTime",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourId = table.Column<int>(type: "int", nullable: false),
                    Time = table.Column<TimeOnly>(type: "time", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourStartTime", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TourStartTime_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TransferRoutePoint",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransferRoutePoint", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransferRoutePoint_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VehicleClass",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    LuggageCapacity = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehicleClass", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TransferRoutePointTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TransferRoutePointId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransferRoutePointTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransferRoutePointTranslation_TransferRoutePoint_TransferRoutePointId",
                        column: x => x.TransferRoutePointId,
                        principalTable: "TransferRoutePoint",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomTransferDetails",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderLineId = table.Column<int>(type: "int", nullable: false),
                    PassengerCount = table.Column<int>(type: "int", nullable: false),
                    LuggageMediumCount = table.Column<int>(type: "int", nullable: false),
                    LuggageLargeCount = table.Column<int>(type: "int", nullable: false),
                    LuggageOther = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DesiredVehicleClassId = table.Column<int>(type: "int", nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomTransferDetails", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomTransferDetails_OrderLine_OrderLineId",
                        column: x => x.OrderLineId,
                        principalTable: "OrderLine",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CustomTransferDetails_VehicleClass_DesiredVehicleClassId",
                        column: x => x.DesiredVehicleClassId,
                        principalTable: "VehicleClass",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TransferPrice",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourId = table.Column<int>(type: "int", nullable: false),
                    VehicleClassId = table.Column<int>(type: "int", nullable: false),
                    OneWayPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    RoundTripPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransferPrice", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransferPrice_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TransferPrice_VehicleClass_VehicleClassId",
                        column: x => x.VehicleClassId,
                        principalTable: "VehicleClass",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VehicleClassTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VehicleClassId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehicleClassTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VehicleClassTranslation_VehicleClass_VehicleClassId",
                        column: x => x.VehicleClassId,
                        principalTable: "VehicleClass",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomTransferStop",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomTransferDetailsId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomTransferStop", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomTransferStop_CustomTransferDetails_CustomTransferDetailsId",
                        column: x => x.CustomTransferDetailsId,
                        principalTable: "CustomTransferDetails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderLine_VehicleClassId",
                table: "OrderLine",
                column: "VehicleClassId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomTransferDetails_DesiredVehicleClassId",
                table: "CustomTransferDetails",
                column: "DesiredVehicleClassId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomTransferDetails_OrderLineId",
                table: "CustomTransferDetails",
                column: "OrderLineId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomTransferStop_CustomTransferDetailsId",
                table: "CustomTransferStop",
                column: "CustomTransferDetailsId");

            migrationBuilder.CreateIndex(
                name: "IX_TourStartTime_TourId_Time",
                table: "TourStartTime",
                columns: new[] { "TourId", "Time" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransferPrice_TourId_VehicleClassId",
                table: "TransferPrice",
                columns: new[] { "TourId", "VehicleClassId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransferPrice_VehicleClassId",
                table: "TransferPrice",
                column: "VehicleClassId");

            migrationBuilder.CreateIndex(
                name: "IX_TransferRoutePoint_TourId",
                table: "TransferRoutePoint",
                column: "TourId");

            migrationBuilder.CreateIndex(
                name: "IX_TransferRoutePointTranslation_TransferRoutePointId",
                table: "TransferRoutePointTranslation",
                column: "TransferRoutePointId");

            migrationBuilder.CreateIndex(
                name: "IX_VehicleClassTranslation_VehicleClassId",
                table: "VehicleClassTranslation",
                column: "VehicleClassId");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderLine_VehicleClass_VehicleClassId",
                table: "OrderLine",
                column: "VehicleClassId",
                principalTable: "VehicleClass",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // --- Существующие продукты ---------------------------------------------------
            // Format = 1 (TourFormat.Individual) всем турам и экскурсиям: до этого батча цена
            // считалась ровно по индивидуальной схеме (фикс за группу + тир 1-4/5-6/7+), так
            // что это фиксация текущего поведения, а не его изменение. Трансферов (Type = 3)
            // в БД на момент миграции быть не может — тип только появился, но условие по типу
            // оставлено явным: у трансфера формата не бывает вообще.
            migrationBuilder.Sql(
                "UPDATE [Tour] SET [Format] = 1 WHERE [Type] IN (1, 2) AND [Format] IS NULL;");

            // Одно время старта 09:00 каждому существующему продукту: в Фазе 2 «минимум одно
            // время» становится обязательной валидацией, и без этого сида старые туры стали бы
            // нередактируемыми — сохранение падало бы на правиле, которого админ не вводил.
            // Отдельного Down не нужно: строки уходят вместе с таблицей TourStartTime.
            migrationBuilder.Sql(
                "INSERT INTO [TourStartTime] ([TourId], [Time], [SortOrder]) " +
                "SELECT [Id], CAST('09:00:00' AS time), 0 FROM [Tour] WHERE [Type] IN (1, 2);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderLine_VehicleClass_VehicleClassId",
                table: "OrderLine");

            migrationBuilder.DropTable(
                name: "CustomTransferStop");

            migrationBuilder.DropTable(
                name: "TourStartTime");

            migrationBuilder.DropTable(
                name: "TransferPrice");

            migrationBuilder.DropTable(
                name: "TransferRoutePointTranslation");

            migrationBuilder.DropTable(
                name: "VehicleClassTranslation");

            migrationBuilder.DropTable(
                name: "CustomTransferDetails");

            migrationBuilder.DropTable(
                name: "TransferRoutePoint");

            migrationBuilder.DropTable(
                name: "VehicleClass");

            migrationBuilder.DropIndex(
                name: "IX_OrderLine_VehicleClassId",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "Format",
                table: "Tour");

            migrationBuilder.DropColumn(
                name: "GroupCapacity",
                table: "Tour");

            migrationBuilder.DropColumn(
                name: "GroupPricePerPerson",
                table: "Tour");

            migrationBuilder.DropColumn(
                name: "Format",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "IsRoundTrip",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "LineKind",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "ReturnDate",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "ReturnTime",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "VehicleClassId",
                table: "OrderLine");

            migrationBuilder.DropColumn(
                name: "VehicleClassNameSnapshot",
                table: "OrderLine");

            migrationBuilder.AlterColumn<int>(
                name: "TourId",
                table: "OrderLine",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
