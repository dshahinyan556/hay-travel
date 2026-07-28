using ATTours.Common.Settings;
using System.Text.RegularExpressions;

namespace ATTours.Helper.Helper
{
    public static class RegexHelper
    {
        public static Regex Create(string regexPattern)
        {
            try
            {
                return CreateRegexByOptions(regexPattern, RegexOptions.NonBacktracking);
            }
            catch
            {
                return CreateRegexByOptions(regexPattern, RegexOptions.None);
            }
        }

        public static Regex CreateRegexByOptions(string regexPattern, RegexOptions regexOptions)
            => new(regexPattern, regexOptions, RegexSettings.Instance.RegexMatchTimeout);
    }
}
