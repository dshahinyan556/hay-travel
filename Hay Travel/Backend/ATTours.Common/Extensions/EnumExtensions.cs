using ATTours.Common.Enums;
using ATTours.Exceptions;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Reflection;

namespace ATTours.Common.Extensions
{
    public static class EnumExtensions
    {
        public static string TryGetDescriptionName<TEnum>(this TEnum enumValue)
            where TEnum : Enum
            => enumValue.GetAttribute<DescriptionAttribute>()?.Description;

        public static string TryGetDisplayName<TEnum>(this TEnum value)
            where TEnum : Enum
            => value.GetAttribute<DisplayAttribute>()?.Name;

        public static TAttribute GetAttribute<TAttribute>(this Enum enumValue)
            where TAttribute : Attribute
        {
            return enumValue.GetEnumMemberInfo().GetCustomAttribute<TAttribute>();
        }

        public static IEnumerable<TAttribute> GetAttributes<TAttribute>(this Enum enumValue)
            where TAttribute : Attribute
        {
            return enumValue.GetEnumMemberInfo().GetCustomAttributes<TAttribute>();
        }

        public static TAttribute GetAttribute<TAttribute>(this Enum enumValue, Func<TAttribute, bool> predicate)
            where TAttribute : Attribute
        {
            return enumValue.GetAttributes<TAttribute>().FirstOrDefault(predicate);
        }

        private static MemberInfo GetEnumMemberInfo(this Enum enumValue)
        {
            return enumValue.GetType()
                            .GetMember(enumValue.ToString())
                            .First();
        }

        public static List<TEnum> GetFlagMembers<TEnum>(this TEnum flag)
            where TEnum : Enum
        {
            if (flag.GetType().GetCustomAttribute<FlagsAttribute>() == null)
                return new() { flag };
            var flagMembers = new List<TEnum>();
            foreach (TEnum flagMember in Enum.GetValues(flag.GetType()))
                if (flag.HasFlag(flagMember))
                    flagMembers.Add(flagMember);
            return flagMembers;
        }

        public static List<string> GetEnumDescriptions<T>() where T : Enum
        {
            var descriptions = new List<string>();
            foreach (var value in Enum.GetValues(typeof(T)))
            {
                FieldInfo field = typeof(T).GetField(value.ToString());
                DescriptionAttribute attr = (DescriptionAttribute)Attribute.GetCustomAttribute(field, typeof(DescriptionAttribute));
                descriptions.Add(attr != null ? attr.Description : value.ToString());
            }
            return descriptions;
        }

        public static char ToChar(this SymbolType symbolType)
        {
            return (char)symbolType;
        }

        public static TEnum StringToEnumByDescription<TEnum>(this string stringValue)
           where TEnum : struct, Enum
        {
            var enumValues = Enum.GetValues<TEnum>();
            foreach (var enumValue in enumValues)
            {
                var description = enumValue.TryGetDescriptionName();
                if (stringValue == description)
                    return enumValue;
            }

            throw new ATToursException("Enum value does not match any description!");
        }

        public static TEnum StringToEnum<TEnum>(this string stringValue)
            where TEnum : struct, Enum
        {
            return (TEnum)Enum.Parse(typeof(TEnum), stringValue);
        }
    }
}
