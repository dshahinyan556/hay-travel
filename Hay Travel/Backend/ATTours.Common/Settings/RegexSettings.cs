using Microsoft.Extensions.Configuration;
using System.Globalization;

namespace ATTours.Common.Settings
{
    public class RegexSettings : ApplicationSettingsBase<RegexSettings>
    {
        public TimeSpan RegexMatchTimeout => TimeSpan.Parse(Configuration.GetSection(nameof(RegexMatchTimeout)).Get<string>(), CultureInfo.InvariantCulture);

    }
}
