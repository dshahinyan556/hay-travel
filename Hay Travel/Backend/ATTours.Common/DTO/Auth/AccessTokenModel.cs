namespace ATTours.Common.DTO.Auth
{
    public class AccessTokenModel
    {
        public string AccessToken { get; set; }
        public int ExpiresInSeconds { get; set; }
    }
}
