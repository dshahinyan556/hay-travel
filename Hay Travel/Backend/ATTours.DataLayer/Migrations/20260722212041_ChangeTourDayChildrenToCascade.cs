using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class ChangeTourDayChildrenToCascade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GalleryImage_TourDay_TourDayId",
                table: "GalleryImage");

            migrationBuilder.DropForeignKey(
                name: "FK_TourDayInfoTranslation_TourDay_TourDayId",
                table: "TourDayInfoTranslation");

            migrationBuilder.AddForeignKey(
                name: "FK_GalleryImage_TourDay_TourDayId",
                table: "GalleryImage",
                column: "TourDayId",
                principalTable: "TourDay",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TourDayInfoTranslation_TourDay_TourDayId",
                table: "TourDayInfoTranslation",
                column: "TourDayId",
                principalTable: "TourDay",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GalleryImage_TourDay_TourDayId",
                table: "GalleryImage");

            migrationBuilder.DropForeignKey(
                name: "FK_TourDayInfoTranslation_TourDay_TourDayId",
                table: "TourDayInfoTranslation");

            migrationBuilder.AddForeignKey(
                name: "FK_GalleryImage_TourDay_TourDayId",
                table: "GalleryImage",
                column: "TourDayId",
                principalTable: "TourDay",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TourDayInfoTranslation_TourDay_TourDayId",
                table: "TourDayInfoTranslation",
                column: "TourDayId",
                principalTable: "TourDay",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
