namespace ATTours.Helper.Attributes
{
    public class EntityRelationAttribute : Attribute
    {
        public EntityRelationAttribute(string relatedEntityName)
        {
            RelatedEntityName = relatedEntityName;
        }

        public string RelatedEntityName { get; }
    }
}
