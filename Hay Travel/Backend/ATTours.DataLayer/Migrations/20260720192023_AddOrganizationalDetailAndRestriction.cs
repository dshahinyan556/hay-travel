using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationalDetailAndRestriction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrganizationalDetail",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourId = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationalDetail", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationalDetail_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Restriction",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourId = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Restriction", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Restriction_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationalDetailTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationalDetailId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationalDetailTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationalDetailTranslation_OrganizationalDetail_OrganizationalDetailId",
                        column: x => x.OrganizationalDetailId,
                        principalTable: "OrganizationalDetail",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RestrictionTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RestrictionId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RestrictionTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RestrictionTranslation_Restriction_RestrictionId",
                        column: x => x.RestrictionId,
                        principalTable: "Restriction",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationalDetail_TourId",
                table: "OrganizationalDetail",
                column: "TourId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationalDetailTranslation_OrganizationalDetailId",
                table: "OrganizationalDetailTranslation",
                column: "OrganizationalDetailId");

            migrationBuilder.CreateIndex(
                name: "IX_Restriction_TourId",
                table: "Restriction",
                column: "TourId");

            migrationBuilder.CreateIndex(
                name: "IX_RestrictionTranslation_RestrictionId",
                table: "RestrictionTranslation",
                column: "RestrictionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationalDetailTranslation");

            migrationBuilder.DropTable(
                name: "RestrictionTranslation");

            migrationBuilder.DropTable(
                name: "OrganizationalDetail");

            migrationBuilder.DropTable(
                name: "Restriction");
        }
    }
}
