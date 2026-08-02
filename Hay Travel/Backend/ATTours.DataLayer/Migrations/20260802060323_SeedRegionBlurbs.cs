using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    // Данные (не схема): тизеры (RegionTranslationType.Blurb = 2) для 11 регионов, RU+EN, raw SQL
    // (ADR 001) — по образцу SeedArmenianRegions. Текст перенесён дословно из
    // Frontend/src/shared/data/armeniaRegions.ts (`blurb`/`blurbEn`), которые становятся
    // редактируемыми в админке (RegionsTab, `UpdateBlurb`) начиная с этой доработки.
    // Идемпотентно: NOT EXISTS не даёт продублировать строку при повторном ручном прогоне.
    public partial class SeedRegionBlurbs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // RegionTranslationType.Blurb = 2, LanguageCode.Russian = 1.
            migrationBuilder.Sql(@"
INSERT INTO [RegionTranslation] ([RegionId], [Type], [LanguageCode], [Value])
SELECT r.[Id], 2, 1,
    CASE r.[Slug]
        WHEN 'yerevan' THEN N'Каскад, Вернисаж, площадь Республики'
        WHEN 'aragatsotn' THEN N'Амберд, Сагмосаванк, склоны Арагаца'
        WHEN 'ararat' THEN N'Хор Вирап на фоне Арарата'
        WHEN 'armavir' THEN N'Эчмиадзин, Звартноц, виноградники'
        WHEN 'gegharkunik' THEN N'Севан, Севанаванк, горные пляжи'
        WHEN 'kotayk' THEN N'Гарни, Гегард, Цахкадзор'
        WHEN 'lori' THEN N'Санаин, Ахпат, ущелье Дебед'
        WHEN 'shirak' THEN N'Гюмри, Мармашен, чёрный туф'
        WHEN 'syunik' THEN N'Татев, Крылья Татева, Хндзореск'
        WHEN 'vayots-dzor' THEN N'Нораванк, Арени, пещера птиц'
        WHEN 'tavush' THEN N'Дилижан, Агарцин, Гошаванк'
    END
FROM [Region] r
WHERE r.[Slug] IN ('yerevan', 'aragatsotn', 'ararat', 'armavir', 'gegharkunik', 'kotayk', 'lori', 'shirak', 'syunik', 'vayots-dzor', 'tavush')
  AND NOT EXISTS (
      SELECT 1 FROM [RegionTranslation] rt
      WHERE rt.[RegionId] = r.[Id] AND rt.[Type] = 2 AND rt.[LanguageCode] = 1
  );
");

            // RegionTranslationType.Blurb = 2, LanguageCode.English = 2.
            migrationBuilder.Sql(@"
INSERT INTO [RegionTranslation] ([RegionId], [Type], [LanguageCode], [Value])
SELECT r.[Id], 2, 2,
    CASE r.[Slug]
        WHEN 'yerevan' THEN N'Cascade Complex, Vernissage market, Republic Square'
        WHEN 'aragatsotn' THEN N'Amberd, Saghmosavank, the slopes of Mount Aragats'
        WHEN 'ararat' THEN N'Khor Virap against Mount Ararat'
        WHEN 'armavir' THEN N'Echmiadzin, Zvartnots, vineyards'
        WHEN 'gegharkunik' THEN N'Lake Sevan, Sevanavank, mountain beaches'
        WHEN 'kotayk' THEN N'Garni, Geghard, Tsaghkadzor'
        WHEN 'lori' THEN N'Sanahin, Haghpat, the Debed gorge'
        WHEN 'shirak' THEN N'Gyumri, Marmashen, black tuff'
        WHEN 'syunik' THEN N'Tatev, the Wings of Tatev, Khndzoresk'
        WHEN 'vayots-dzor' THEN N'Noravank, Areni, the Bird Cave'
        WHEN 'tavush' THEN N'Dilijan, Haghartsin, Goshavank'
    END
FROM [Region] r
WHERE r.[Slug] IN ('yerevan', 'aragatsotn', 'ararat', 'armavir', 'gegharkunik', 'kotayk', 'lori', 'shirak', 'syunik', 'vayots-dzor', 'tavush')
  AND NOT EXISTS (
      SELECT 1 FROM [RegionTranslation] rt
      WHERE rt.[RegionId] = r.[Id] AND rt.[Type] = 2 AND rt.[LanguageCode] = 2
  );
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM [RegionTranslation]
WHERE [Type] = 2
  AND [RegionId] IN (
      SELECT [Id] FROM [Region]
      WHERE [Slug] IN ('yerevan', 'aragatsotn', 'ararat', 'armavir', 'gegharkunik', 'kotayk', 'lori', 'shirak', 'syunik', 'vayots-dzor', 'tavush')
  );
");
        }
    }
}
