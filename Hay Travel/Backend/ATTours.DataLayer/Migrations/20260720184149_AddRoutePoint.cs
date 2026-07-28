using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddRoutePoint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RoutePoint",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourDayId = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoutePoint", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoutePoint_TourDay_TourDayId",
                        column: x => x.TourDayId,
                        principalTable: "TourDay",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RoutePointTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoutePointId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoutePointTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoutePointTranslation_RoutePoint_RoutePointId",
                        column: x => x.RoutePointId,
                        principalTable: "RoutePoint",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RoutePoint_TourDayId",
                table: "RoutePoint",
                column: "TourDayId");

            migrationBuilder.CreateIndex(
                name: "IX_RoutePointTranslation_RoutePointId",
                table: "RoutePointTranslation",
                column: "RoutePointId");

            migrationBuilder.Sql("DELETE FROM TourDayInfoTranslation WHERE Type = 5;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RoutePointTranslation");

            migrationBuilder.DropTable(
                name: "RoutePoint");
        }
    }
}
