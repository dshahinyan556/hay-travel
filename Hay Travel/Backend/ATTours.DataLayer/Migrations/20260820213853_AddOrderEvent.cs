using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrderEvent",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    ActorUserId = table.Column<int>(type: "int", nullable: true),
                    ActorFullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderEvent", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderEvent_Order_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Order",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderEvent_OrderId_CreatedAtUtc",
                table: "OrderEvent",
                columns: new[] { "OrderId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderEvent");
        }
    }
}
