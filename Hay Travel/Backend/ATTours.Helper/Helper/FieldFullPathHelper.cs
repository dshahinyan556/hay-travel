using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

namespace ATTours.Helper.Helper
{
    public partial class FieldFullPathHelper
    {
        public static string GetCleanedPathFromObject(object fieldFullPath, [CallerArgumentExpression(nameof(fieldFullPath))] string path = "")
        {
            return CleanPathString(path);
        }

        public static string CleanPathString(string path)
        {
            var parts = path.Split('.');
            string cleanedPath = string.Join(".", parts[1..]);
            cleanedPath = RemoveArrayIndices(cleanedPath);
            return cleanedPath;
        }

        public static string RemoveArrayIndices(string path)
        {
            return RemoveIndexFormatRegex().Replace(path, string.Empty);
        }

        [GeneratedRegex(@"\[\d+\]")]
        private static partial Regex RemoveIndexFormatRegex();
    }
}
