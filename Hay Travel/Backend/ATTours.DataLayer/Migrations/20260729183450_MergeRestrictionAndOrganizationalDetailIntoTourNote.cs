using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    // Слияние Restriction + OrganizationalDetail в TourNote с полем Type (ADR 003).
    //
    // Схема сгенерирована `dotnet ef migrations add`, но ПОРЯДОК ОПЕРАЦИЙ И ПЕРЕНОС ДАННЫХ
    // дописаны вручную. Скаффолдер сгенерировал четыре DropTable ПЕРЕД CreateTable
    // (и честно предупредил: "An operation was scaffolded that may result in the loss of
    // data") — в таком виде миграция уничтожила бы все орг. детали и ограничения.
    // Здесь порядок обратный: сначала новые таблицы, потом перенос, и только потом Drop.
    //
    // Перенос идёт через временные колонки LegacyId/LegacySource на TourNote: они держат
    // старый ключ ровно столько, сколько нужно, чтобы приджойнить переводы, и удаляются
    // в этой же миграции (в модели EF их нет и быть не должно).
    //
    // Временные колонки объявлены прямо в CreateTable, а не через отдельный AddColumn.
    // Это не косметика: `dotnet ef migrations script` укладывает всю миграцию в ОДИН
    // батч, а SQL Server не даёт сослаться на колонку, добавленную через ALTER TABLE
    // в том же батче ("Invalid column name"). Для новой таблицы работает deferred name
    // resolution, поэтому вариант с CreateTable корректен и при `database update`
    // (покомандно), и при прогоне сгенерированного скрипта целиком.
    //
    // SortOrder переносится КАК ЕСТЬ, отдельно для каждого типа: у тура получаются два
    // независимых диапазона 0..n-1 (свой у орг. деталей, свой у ограничений). Никакой
    // сквозной перенумерации здесь нет и быть не должно — чтение всегда идёт
    // Where(Type == X).OrderBy(SortOrder).
    public partial class MergeRestrictionAndOrganizationalDetailIntoTourNote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // --- 1. Новые таблицы (блок EF + две временные колонки) -------------------

            migrationBuilder.CreateTable(
                name: "TourNote",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourId = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    // Строительные леса переноса: живут только внутри этой миграции,
                    // дропаются на шаге 4. В модели EF их нет.
                    LegacyId = table.Column<int>(type: "int", nullable: true),
                    LegacySource = table.Column<byte>(type: "tinyint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourNote", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TourNote_Tour_TourId",
                        column: x => x.TourId,
                        principalTable: "Tour",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TourNoteTranslation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourNoteId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TourNoteTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TourNoteTranslation_TourNote_TourNoteId",
                        column: x => x.TourNoteId,
                        principalTable: "TourNote",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TourNote_TourId_Type",
                table: "TourNote",
                columns: new[] { "TourId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_TourNoteTranslation_TourNoteId",
                table: "TourNoteTranslation",
                column: "TourNoteId");

            // --- 2. Перенос самих заметок --------------------------------------------
            // TourNoteType.OrganizationalDetail = 1, TourNoteType.Restriction = 2.
            // LegacySource повторяет Type, но существует отдельно: Type — доменное поле,
            // LegacySource — техническая метка происхождения строки, по ней джойнятся
            // переводы. Если бы кто-то поменял значения enum, джойн не должен поехать.

            migrationBuilder.Sql(@"
INSERT INTO [TourNote] ([TourId], [Type], [SortOrder], [LegacyId], [LegacySource])
SELECT [TourId], 1, [SortOrder], [Id], 1
FROM [OrganizationalDetail];
");

            migrationBuilder.Sql(@"
INSERT INTO [TourNote] ([TourId], [Type], [SortOrder], [LegacyId], [LegacySource])
SELECT [TourId], 2, [SortOrder], [Id], 2
FROM [Restriction];
");

            // --- 3. Перенос переводов ------------------------------------------------
            // JOIN по паре (LegacySource, LegacyId) — Id орг. детали и Id ограничения
            // могли совпадать, поэтому одного LegacyId недостаточно.
            // INNER JOIN осознанный: перевод-сирота (FK не даёт такому появиться) не
            // должен создать заметку из ниоткуда.

            migrationBuilder.Sql(@"
INSERT INTO [TourNoteTranslation] ([TourNoteId], [LanguageCode], [Value])
SELECT n.[Id], t.[LanguageCode], t.[Value]
FROM [OrganizationalDetailTranslation] t
INNER JOIN [TourNote] n
    ON n.[LegacySource] = 1 AND n.[LegacyId] = t.[OrganizationalDetailId];
");

            migrationBuilder.Sql(@"
INSERT INTO [TourNoteTranslation] ([TourNoteId], [LanguageCode], [Value])
SELECT n.[Id], t.[LanguageCode], t.[Value]
FROM [RestrictionTranslation] t
INNER JOIN [TourNote] n
    ON n.[LegacySource] = 2 AND n.[LegacyId] = t.[RestrictionId];
");

            // --- 4. Убираем строительные леса ----------------------------------------

            migrationBuilder.DropColumn(name: "LegacyId", table: "TourNote");
            migrationBuilder.DropColumn(name: "LegacySource", table: "TourNote");

            // --- 5. Только теперь старые таблицы ------------------------------------
            // Переводы раньше своих родителей — FK-каскад отработал бы и сам,
            // но явный порядок читается однозначно.

            migrationBuilder.DropTable(name: "OrganizationalDetailTranslation");
            migrationBuilder.DropTable(name: "RestrictionTranslation");
            migrationBuilder.DropTable(name: "OrganizationalDetail");
            migrationBuilder.DropTable(name: "Restriction");
        }

        /// <inheritdoc />
        // Откат зеркальный: старые таблицы -> перенос по Type -> дроп новых.
        //
        // ЧТО ОТКАТ НЕ ВОССТАНАВЛИВАЕТ (сознательно, а не по недосмотру):
        // 1. Id. И заметки, и их переводы получают новые identity-значения. Открытая
        //    в момент отката форма тура в админке отправит устаревшие id и получит 400.
        // 2. Заметки с Type, отличным от 1 и 2 (появиться через API не могут — enum
        //    закрыт; теоретически возможны только при ручной правке БД). Такие строки
        //    в старую схему не раскладываются и будут потеряны вместе с переводами.
        // Всё остальное — TourId, SortOrder (внутри своего типа), LanguageCode, Value,
        // принадлежность перевода заметке — переносится один в один.
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // --- 1. Старые таблицы (блок EF + временная колонка) ----------------------
            // LegacyNoteId объявлена прямо в CreateTable по той же причине, что и
            // LegacyId/LegacySource в Up: батч-безопасность сгенерированного скрипта.

            migrationBuilder.CreateTable(
                name: "OrganizationalDetail",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TourId = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    // Строительные леса отката, дропаются на шаге 4.
                    LegacyNoteId = table.Column<int>(type: "int", nullable: true)
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
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    // Строительные леса отката, дропаются на шаге 4.
                    LegacyNoteId = table.Column<int>(type: "int", nullable: true)
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

            // --- 2. Обратный перенос заметок по Type ---------------------------------
            // LegacyNoteId хранит Id заметки, из которой выросла строка; по ней ниже
            // раскладываются переводы.

            migrationBuilder.Sql(@"
INSERT INTO [OrganizationalDetail] ([TourId], [SortOrder], [LegacyNoteId])
SELECT [TourId], [SortOrder], [Id]
FROM [TourNote]
WHERE [Type] = 1;
");

            migrationBuilder.Sql(@"
INSERT INTO [Restriction] ([TourId], [SortOrder], [LegacyNoteId])
SELECT [TourId], [SortOrder], [Id]
FROM [TourNote]
WHERE [Type] = 2;
");

            // --- 3. Обратный перенос переводов ---------------------------------------
            // Перевод едет туда же, куда уехала его заметка: если заметка была Type = 1,
            // её переводы попадают в OrganizationalDetailTranslation, и никуда больше.

            migrationBuilder.Sql(@"
INSERT INTO [OrganizationalDetailTranslation] ([OrganizationalDetailId], [LanguageCode], [Value])
SELECT o.[Id], t.[LanguageCode], t.[Value]
FROM [TourNoteTranslation] t
INNER JOIN [OrganizationalDetail] o ON o.[LegacyNoteId] = t.[TourNoteId];
");

            migrationBuilder.Sql(@"
INSERT INTO [RestrictionTranslation] ([RestrictionId], [LanguageCode], [Value])
SELECT r.[Id], t.[LanguageCode], t.[Value]
FROM [TourNoteTranslation] t
INNER JOIN [Restriction] r ON r.[LegacyNoteId] = t.[TourNoteId];
");

            // --- 4. Убираем строительные леса ----------------------------------------

            migrationBuilder.DropColumn(name: "LegacyNoteId", table: "OrganizationalDetail");
            migrationBuilder.DropColumn(name: "LegacyNoteId", table: "Restriction");

            // --- 5. Только теперь новые таблицы --------------------------------------

            migrationBuilder.DropTable(name: "TourNoteTranslation");
            migrationBuilder.DropTable(name: "TourNote");
        }
    }
}
