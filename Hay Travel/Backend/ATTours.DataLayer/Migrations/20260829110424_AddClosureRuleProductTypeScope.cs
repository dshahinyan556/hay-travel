using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddClosureRuleProductTypeScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TourType",
                table: "ClosureRule",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClosureRule_TourType_Type",
                table: "ClosureRule",
                columns: new[] { "TourType", "Type" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ClosureRule_TourType_Type",
                table: "ClosureRule");

            migrationBuilder.DropColumn(
                name: "TourType",
                table: "ClosureRule");
        }
    }
}
