using System.Reflection;

namespace ATTours.Common.Extensions
{
    public static class TypeExtensions
    {
        private static readonly BindingFlags comparerBindingFlags = BindingFlags.Instance | BindingFlags.Public;

        //public static string GetKeyFromCacheKeyAttribute(this Type type)
        //{
        //    var cacheKeyAttribute = type.GetCustomAttribute<CacheKeyAttribute>();
        //    if (cacheKeyAttribute is null)
        //        throw new ARPaymentException($"{nameof(CacheKeyAttribute)} not defined");
        //    return cacheKeyAttribute.Key;
        //}

        public static bool IsCollection(this Type type)
        {
            if (type != typeof(string))
            {
                return typeof(System.Collections.IEnumerable).IsAssignableFrom(type);
            }
            return default;
        }

        public static bool IsSimpleType(this Type type) =>
            type.IsPrimitive || type == typeof(string) || type == typeof(decimal);


        public static PropertyInfo GetCollectionPropertyInfoByGenericType(this Type objectType, Type genericType)
        {
            return objectType.GetProperties().FirstOrDefault(x => x.PropertyType.IsCollection() &&
                                                                  x.PropertyType.GetGenericType() == genericType);
        }

        public static Type GetGenericType(this Type type)
        {
            return type.GetGenericArguments()[default];
        }

        public static bool IsDefinedClass(this Type type)
            => !type.IsCollection() && type != typeof(string) && type.IsClass;

        public static PropertyInfo GetInterfacePropertyInfoByAttribute<TAttribute>(this Type type, string propertyName)
            where TAttribute : Attribute
        {
            return type.GetInterfacePropertiesByAttribute<TAttribute>().FirstOrDefault(x => x.Name == propertyName);
        }

        public static bool IsAttributeAppliedProperty<TAttribute>(this Type type, PropertyInfo propertyInfo)
            where TAttribute : Attribute
        {
            var attributeAppliedPropertyInfo = type.GetInterfacePropertyInfoByAttribute<TAttribute>(propertyInfo.Name);
            return attributeAppliedPropertyInfo is not null;
        }

        public static List<PropertyInfo> GetInterfacePropertiesByAttribute<TAttribute>(this Type type)
           where TAttribute : Attribute
        {
            return type.GetInterfaces()
                       .SelectMany(x => x.GetProperties(comparerBindingFlags)
                                         .Where(p => p.CanRead &&
                                                     p.GetCustomAttribute<TAttribute>() != null))
                       .ToList();
        }

        public static List<TAttribute> GetInterfaceAttributes<TAttribute>(this Type type)
           where TAttribute : Attribute
        {
            return type.GetInterfaces().SelectMany(x => x.GetCustomAttributes<TAttribute>()).ToList();
        }

        public static TAttribute GetInterfaceAttribute<TAttribute>(this Type type)
           where TAttribute : Attribute
        {
            return type.GetInterfaces().FirstOrDefault(x => x.GetCustomAttribute<TAttribute>() != null)?
                                       .GetCustomAttribute<TAttribute>();
        }

        public static IEnumerable<PropertyInfo> GetInheritedProperties<T, TAttribute>(this T model)
            where TAttribute : Attribute
        {
            var modelType = model.GetType();
            var properties = modelType.GetInterfaces().Append(modelType)
                                      .SelectMany(t => t.GetProperties())
                                      .Where(p => p.IsDefined(typeof(TAttribute), true));
            return properties;
        }

        public static List<PropertyInfo> GetPropertiesByAttribute<TAttribute>(this Type type)
           where TAttribute : Attribute
        {
            return type.GetProperties(comparerBindingFlags).Where(x => x.GetCustomAttribute<TAttribute>() != null).ToList();
        }

        public static bool IsDefaultValue(this Type type, object value)
        {
            return value.Equals(type.GetDefaultValue());
        }

        public static object GetDefaultValue(this Type type)
        {
            return type.IsValueType
               ? Activator.CreateInstance(type)
               : null;
        }

        public static Dictionary<PropertyInfo, TAttribute> GetPropertiesWithAttributesByBaseAttribute<TAttribute>(this Type type)
            where TAttribute : class
        {
            return type.GetProperties().Select(prop => new
            {
                Property = prop,
                Attribute = prop.GetAttributeByAttributeBaseFromInterface<TAttribute>()
            })
                                                  .Where(x => x.Attribute != null)
                                                  .ToDictionary(x => x.Property, x => x.Attribute);
        }
    }
}
