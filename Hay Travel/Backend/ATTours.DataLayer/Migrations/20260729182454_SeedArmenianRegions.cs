using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    // Данные (не схема): 11 регионов Армении + переводы RU/EN, raw SQL (ADR 001) —
    // не HasData, чтобы отредактированные вручную переводы не «чинились» снапшотом модели.
    // Slug/RU/EN и SortOrder перенесены дословно из
    // Frontend/src/shared/data/armeniaRegions.ts (SortOrder = индекс в массиве REGIONS).
    // Регионы вставляются без явных Id; переводы — SELECT-ом с сопоставлением по Slug,
    // поэтому SET IDENTITY_INSERT и хардкод идентификаторов не нужны.
    // Идемпотентно в разумных пределах: NOT EXISTS-проверки не дают продублировать
    // регион/перевод при повторном ручном прогоне миграции.
    public partial class SeedArmenianRegions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO [Region] ([Slug], [SortOrder])
SELECT v.[Slug], v.[SortOrder]
FROM (VALUES
    ('yerevan', 0),
    ('aragatsotn', 1),
    ('ararat', 2),
    ('armavir', 3),
    ('gegharkunik', 4),
    ('kotayk', 5),
    ('lori', 6),
    ('shirak', 7),
    ('syunik', 8),
    ('vayots-dzor', 9),
    ('tavush', 10)
) AS v([Slug], [SortOrder])
WHERE NOT EXISTS (SELECT 1 FROM [Region] r WHERE r.[Slug] = v.[Slug]);
");

            // RegionTranslationType.Name = 1, LanguageCode.Russian = 1.
            migrationBuilder.Sql(@"
INSERT INTO [RegionTranslation] ([RegionId], [Type], [LanguageCode], [Value])
SELECT r.[Id], 1, 1,
    CASE r.[Slug]
        WHEN 'yerevan' THEN N'Ереван'
        WHEN 'aragatsotn' THEN N'Арагацотн'
        WHEN 'ararat' THEN N'Арарат'
        WHEN 'armavir' THEN N'Армавир'
        WHEN 'gegharkunik' THEN N'Гегаркуник'
        WHEN 'kotayk' THEN N'Котайк'
        WHEN 'lori' THEN N'Лори'
        WHEN 'shirak' THEN N'Ширак'
        WHEN 'syunik' THEN N'Сюник'
        WHEN 'vayots-dzor' THEN N'Вайоц-Дзор'
        WHEN 'tavush' THEN N'Тавуш'
    END
FROM [Region] r
WHERE r.[Slug] IN ('yerevan', 'aragatsotn', 'ararat', 'armavir', 'gegharkunik', 'kotayk', 'lori', 'shirak', 'syunik', 'vayots-dzor', 'tavush')
  AND NOT EXISTS (
      SELECT 1 FROM [RegionTranslation] rt
      WHERE rt.[RegionId] = r.[Id] AND rt.[Type] = 1 AND rt.[LanguageCode] = 1
  );
");

            // RegionTranslationType.Name = 1, LanguageCode.English = 2.
            migrationBuilder.Sql(@"
INSERT INTO [RegionTranslation] ([RegionId], [Type], [LanguageCode], [Value])
SELECT r.[Id], 1, 2,
    CASE r.[Slug]
        WHEN 'yerevan' THEN N'Yerevan'
        WHEN 'aragatsotn' THEN N'Aragatsotn'
        WHEN 'ararat' THEN N'Ararat'
        WHEN 'armavir' THEN N'Armavir'
        WHEN 'gegharkunik' THEN N'Gegharkunik'
        WHEN 'kotayk' THEN N'Kotayk'
        WHEN 'lori' THEN N'Lori'
        WHEN 'shirak' THEN N'Shirak'
        WHEN 'syunik' THEN N'Syunik'
        WHEN 'vayots-dzor' THEN N'Vayots Dzor'
        WHEN 'tavush' THEN N'Tavush'
    END
FROM [Region] r
WHERE r.[Slug] IN ('yerevan', 'aragatsotn', 'ararat', 'armavir', 'gegharkunik', 'kotayk', 'lori', 'shirak', 'syunik', 'vayots-dzor', 'tavush')
  AND NOT EXISTS (
      SELECT 1 FROM [RegionTranslation] rt
      WHERE rt.[RegionId] = r.[Id] AND rt.[Type] = 1 AND rt.[LanguageCode] = 2
  );
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM [RegionTranslation]
WHERE [RegionId] IN (
    SELECT [Id] FROM [Region]
    WHERE [Slug] IN ('yerevan', 'aragatsotn', 'ararat', 'armavir', 'gegharkunik', 'kotayk', 'lori', 'shirak', 'syunik', 'vayots-dzor', 'tavush')
);
");

            migrationBuilder.Sql(@"
DELETE FROM [Region]
WHERE [Slug] IN ('yerevan', 'aragatsotn', 'ararat', 'armavir', 'gegharkunik', 'kotayk', 'lori', 'shirak', 'syunik', 'vayots-dzor', 'tavush');
");
        }
    }
}
