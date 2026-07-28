using System.Reflection;

namespace ATTours.Common.Extensions
{
    public static class PropertyInfoExtensions
    {
        public static TAttribute GetCustomAttributeFromInterface<TAttribute>(this PropertyInfo propertyInfo)
          where TAttribute : Attribute
        {
            return propertyInfo.ReflectedType.GetInterfacePropertyInfoByAttribute<TAttribute>(propertyInfo.Name)?
                                             .GetCustomAttribute<TAttribute>();
        }

        public static TAttribute GetAttributeByAttributeBaseFromInterface<TAttribute>(this PropertyInfo propertyInfo)
            where TAttribute : class
        {
            foreach (var modelInterface in propertyInfo.DeclaringType.GetInterfaces())
            {
                var interfaceProperty = modelInterface.GetProperty(propertyInfo.Name);
                if (interfaceProperty == null)
                    continue;

                var attribute = interfaceProperty.GetCustomAttributes(typeof(TAttribute), true).FirstOrDefault();

                if (attribute != null)
                    return (TAttribute)attribute;
            }

            return null;
        }
    }
}
