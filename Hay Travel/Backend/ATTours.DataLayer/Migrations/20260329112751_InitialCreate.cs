using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Tour",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Type = table.Column<int>(type: "int", nullable: false),
                    TotalPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    MainImageUrl = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tour", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TourDay",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourDay", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AdditionalExpense",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdditionalExpense", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdditionalExpense_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TourInfoTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Type = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    TourId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourInfoTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TourInfoTranslation_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GalleryImage",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourDayId = table.Column<int>(type: "int", nullable: false),
                    Url = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GalleryImage", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GalleryImage_TourDay_TourDayId",
                        column: x => x.TourDayId,
                        principalTable: "TourDay",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TourDayInfoTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Type = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    TourDayId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourDayInfoTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TourDayInfoTranslation_TourDay_TourDayId",
                        column: x => x.TourDayId,
                        principalTable: "TourDay",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TourDetail",
                columns: table => new
                {
                    TourId = table.Column<int>(type: "int", nullable: false),
                    TourDayId = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourDetail", x => new { x.TourId, x.TourDayId });
                    table.ForeignKey(
                        name: "FK_TourDetail_TourDay_TourDayId",
                        column: x => x.TourDayId,
                        principalTable: "TourDay",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TourDetail_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AdditionalExpenseTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AdditionalExpenseId = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdditionalExpenseTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdditionalExpenseTranslation_AdditionalExpense_AdditionalExpenseId",
                        column: x => x.AdditionalExpenseId,
                        principalTable: "AdditionalExpense",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalExpense_TourId",
                table: "AdditionalExpense",
                column: "TourId");

            migrationBuilder.CreateIndex(
                name: "IX_AdditionalExpenseTranslation_AdditionalExpenseId",
                table: "AdditionalExpenseTranslation",
                column: "AdditionalExpenseId");

            migrationBuilder.CreateIndex(
                name: "IX_GalleryImage_TourDayId",
                table: "GalleryImage",
                column: "TourDayId");

            migrationBuilder.CreateIndex(
                name: "IX_Tour_TotalPrice",
                table: "Tour",
                column: "TotalPrice");

            migrationBuilder.CreateIndex(
                name: "IX_Tour_Type",
                table: "Tour",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_TourDayInfoTranslation_TourDayId",
                table: "TourDayInfoTranslation",
                column: "TourDayId");

            migrationBuilder.CreateIndex(
                name: "IX_TourDetail_TourDayId",
                table: "TourDetail",
                column: "TourDayId");

            migrationBuilder.CreateIndex(
                name: "IX_TourInfoTranslation_TourId",
                table: "TourInfoTranslation",
                column: "TourId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdditionalExpenseTranslation");

            migrationBuilder.DropTable(
                name: "GalleryImage");

            migrationBuilder.DropTable(
                name: "TourDayInfoTranslation");

            migrationBuilder.DropTable(
                name: "TourDetail");

            migrationBuilder.DropTable(
                name: "TourInfoTranslation");

            migrationBuilder.DropTable(
                name: "AdditionalExpense");

            migrationBuilder.DropTable(
                name: "TourDay");

            migrationBuilder.DropTable(
                name: "Tour");
        }
    }
}
