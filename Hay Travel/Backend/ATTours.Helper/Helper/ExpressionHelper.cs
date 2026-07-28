using ATTours.Common.Extensions;
using ATTours.Helper.Attributes;
using System.Linq.Expressions;
using System.Reflection;

namespace ATTours.Helper.Helper
{
    public class ExpressionHelper
    {
        public static Expression<Func<T, bool>> CreateRelatedEntityFilterExpression<T>(List<int> relatedEntityIds)
        {
            if (relatedEntityIds is null || !relatedEntityIds.Any())
                return x => false;

            var propertyName = GetRelationalPropertyName<T>();
            var parameter = Expression.Parameter(typeof(T), "x");
            var property = Expression.Property(parameter, propertyName);
            var constant = Expression.Constant(relatedEntityIds);
            var containsMethod = typeof(List<int>).GetMethod(nameof(List<int>.Contains), new[] { typeof(int) });
            var containsExpression = Expression.Call(constant, containsMethod, property);

            return Expression.Lambda<Func<T, bool>>(containsExpression, parameter);
        }

        private static string GetRelationalPropertyName<T>()
        {
            var propertyInfo = typeof(T).GetPropertiesByAttribute<EntityRelationAttribute>().First();

            return propertyInfo.GetCustomAttribute<EntityRelationAttribute>().RelatedEntityName;
        }
    }
}
