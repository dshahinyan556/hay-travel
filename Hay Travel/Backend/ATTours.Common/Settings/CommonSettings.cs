namespace ATTours.Common.Settings
{
    public class CommonSettings : ApplicationSettingsBase<CommonSettings>
    {
        public string ATToursConnectionString => Configuration.GetSection(nameof(ATToursConnectionString)).Value;
        public string AccessKey => Configuration.GetSection(nameof(AccessKey)).Value;
    }
}
