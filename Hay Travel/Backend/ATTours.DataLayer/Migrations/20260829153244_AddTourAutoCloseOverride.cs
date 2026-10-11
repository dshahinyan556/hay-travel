using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddTourAutoCloseOverride : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Исключения из порога автозакрытия по продуктам (батч 2026-08-29). Бэкфилла нет
            // и быть не должно: пустая таблица означает «исключений нет, все продукты живут
            // по глобальному booking.autoCloseLeadTimeHours» — то есть ровно прежнее
            // поведение. Строка на каждый продукт с текущим глобальным значением, наоборот,
            // навсегда отвязала бы каталог от смены этой настройки.
            migrationBuilder.CreateTable(
                name: "TourAutoCloseOverride",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourId = table.Column<int>(type: "int", nullable: false),
                    LeadTimeHours = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourAutoCloseOverride", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TourAutoCloseOverride_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TourAutoCloseOverride_TourId",
                table: "TourAutoCloseOverride",
                column: "TourId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TourAutoCloseOverride");
        }
    }
}
