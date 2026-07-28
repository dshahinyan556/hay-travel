using System.Collections;

namespace ATTours.Common.Extensions
{
    public static class CollectionExtensions
    {
        public static bool IsSingleElement<TEntity>(this ICollection<TEntity> collection)
        {
            return collection.Count == 1;
        }

        public static bool IsEmpty<TEntity>(this ICollection<TEntity> collection)
        {
            return collection.Count == default;
        }

        public static bool IsEmpty(this ICollection collection)
        {
            return collection.Count == default;
        }

        public static bool HasElement(this ICollection collection)
        {
            return !collection.IsEmpty();
        }

        public static bool HasElement<TEntity>(this ICollection<TEntity> collection)
        {
            return !collection.IsEmpty();
        }

        public static T GetNext<T>(this ICollection<T> collection, T currentItem)
        {
            int currentIndex = GetIndex(collection, currentItem, out List<T> list);
            int nextIndex = currentIndex + 1;
            return nextIndex == list.Count ? default : list[nextIndex];
        }

        public static T GetPrevious<T>(this ICollection<T> collection, T currentItem)
        {
            int currentIndex = GetIndex(collection, currentItem, out List<T> list);
            int previousIndex = currentIndex - 1;
            return previousIndex == -1 ? default : list[previousIndex];
        }

        private static int GetIndex<T>(ICollection<T> collection, T currentItem, out List<T> list)
        {
            list = new List<T>(collection);
            int index = list.IndexOf(currentItem);

            if (index == -1)
                throw new ArgumentException("The current item is not in the collection.");
            return index;
        }
    }
}
