using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailChangeRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmailChangeRequest",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    OldEmailCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    OldEmailRequestedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OldEmailExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OldEmailConfirmedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PendingNewEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NewEmailToken = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NewEmailRequestedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NewEmailExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RequestIp = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    UserAgent = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    UsedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailChangeRequest", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmailChangeRequest_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmailChangeRequest_NewEmailToken",
                table: "EmailChangeRequest",
                column: "NewEmailToken",
                unique: true,
                filter: "[NewEmailToken] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_EmailChangeRequest_UserId",
                table: "EmailChangeRequest",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmailChangeRequest");
        }
    }
}
