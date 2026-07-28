namespace ATTours.Common.DTO.Info
{
    public class RestrictionInfoModel
    {
        public int Id { get; set; }
        public int SortOrder { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
