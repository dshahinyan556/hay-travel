namespace ATTours.Common.DTO.Request
{
    public class ReorderFeaturedToursModel
    {
        // Полный список Id уже отмеченных избранными туров, в желаемом порядке.
        public List<int> OrderedIds { get; set; } = [];
    }
}
