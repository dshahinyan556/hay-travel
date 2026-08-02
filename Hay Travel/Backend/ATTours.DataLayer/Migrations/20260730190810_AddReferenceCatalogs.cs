using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddReferenceCatalogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TourNoteTemplateId",
                table: "TourNote",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PlaceId",
                table: "RoutePoint",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExpenseTemplateId",
                table: "AdditionalExpense",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ExpenseTemplate",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseTemplate", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Place",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Slug = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RegionId = table.Column<int>(type: "int", nullable: false),
                    Latitude = table.Column<decimal>(type: "decimal(9,6)", precision: 9, scale: 6, nullable: true),
                    Longitude = table.Column<decimal>(type: "decimal(9,6)", precision: 9, scale: 6, nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Place", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Place_Region_RegionId",
                        column: x => x.RegionId,
                        principalTable: "Region",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TourNoteTemplate",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Type = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourNoteTemplate", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExpenseTemplateTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ExpenseTemplateId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseTemplateTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExpenseTemplateTranslation_ExpenseTemplate_ExpenseTemplateId",
                        column: x => x.ExpenseTemplateId,
                        principalTable: "ExpenseTemplate",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlaceTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PlaceId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlaceTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlaceTranslation_Place_PlaceId",
                        column: x => x.PlaceId,
                        principalTable: "Place",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TourNoteTemplateTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourNoteTemplateId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourNoteTemplateTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TourNoteTemplateTranslation_TourNoteTemplate_TourNoteTemplateId",
                        column: x => x.TourNoteTemplateId,
                        principalTable: "TourNoteTemplate",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TourNote_TourNoteTemplateId",
                table: "TourNote",
                column: "TourNoteTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_RoutePoint_PlaceId",
                table: "RoutePoint",
                column: "PlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalExpense_ExpenseTemplateId",
                table: "AdditionalExpense",
                column: "ExpenseTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseTemplateTranslation_ExpenseTemplateId",
                table: "ExpenseTemplateTranslation",
                column: "ExpenseTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_Place_RegionId",
                table: "Place",
                column: "RegionId");

            migrationBuilder.CreateIndex(
                name: "IX_Place_Slug",
                table: "Place",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlaceTranslation_PlaceId",
                table: "PlaceTranslation",
                column: "PlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_TourNoteTemplate_Type",
                table: "TourNoteTemplate",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_TourNoteTemplateTranslation_TourNoteTemplateId",
                table: "TourNoteTemplateTranslation",
                column: "TourNoteTemplateId");

            migrationBuilder.AddForeignKey(
                name: "FK_AdditionalExpense_ExpenseTemplate_ExpenseTemplateId",
                table: "AdditionalExpense",
                column: "ExpenseTemplateId",
                principalTable: "ExpenseTemplate",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RoutePoint_Place_PlaceId",
                table: "RoutePoint",
                column: "PlaceId",
                principalTable: "Place",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TourNote_TourNoteTemplate_TourNoteTemplateId",
                table: "TourNote",
                column: "TourNoteTemplateId",
                principalTable: "TourNoteTemplate",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AdditionalExpense_ExpenseTemplate_ExpenseTemplateId",
                table: "AdditionalExpense");

            migrationBuilder.DropForeignKey(
                name: "FK_RoutePoint_Place_PlaceId",
                table: "RoutePoint");

            migrationBuilder.DropForeignKey(
                name: "FK_TourNote_TourNoteTemplate_TourNoteTemplateId",
                table: "TourNote");

            migrationBuilder.DropTable(
                name: "ExpenseTemplateTranslation");

            migrationBuilder.DropTable(
                name: "PlaceTranslation");

            migrationBuilder.DropTable(
                name: "TourNoteTemplateTranslation");

            migrationBuilder.DropTable(
                name: "ExpenseTemplate");

            migrationBuilder.DropTable(
                name: "Place");

            migrationBuilder.DropTable(
                name: "TourNoteTemplate");

            migrationBuilder.DropIndex(
                name: "IX_TourNote_TourNoteTemplateId",
                table: "TourNote");

            migrationBuilder.DropIndex(
                name: "IX_RoutePoint_PlaceId",
                table: "RoutePoint");

            migrationBuilder.DropIndex(
                name: "IX_AdditionalExpense_ExpenseTemplateId",
                table: "AdditionalExpense");

            migrationBuilder.DropColumn(
                name: "TourNoteTemplateId",
                table: "TourNote");

            migrationBuilder.DropColumn(
                name: "PlaceId",
                table: "RoutePoint");

            migrationBuilder.DropColumn(
                name: "ExpenseTemplateId",
                table: "AdditionalExpense");
        }
    }
}
