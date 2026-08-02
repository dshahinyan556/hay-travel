namespace ATTours.Common.DTO.Info
{
    public class RegionInfoModel
    {
        public int Id { get; set; }
        public string Slug { get; set; }
        public int SortOrder { get; set; }
        // Публикуемых туров в регионе (IsActive && !IsArchived).
        public int TourCount { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
