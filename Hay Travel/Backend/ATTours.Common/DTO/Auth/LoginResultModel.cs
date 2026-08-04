namespace ATTours.Common.DTO.Auth
{
    // Refresh-токена здесь нет намеренно: он уходит только в httpOnly-cookie,
    // чтобы быть недоступным JavaScript.
    public class LoginResultModel
    {
        public string AccessToken { get; set; }
        public int ExpiresInSeconds { get; set; }
        public UserInfoModel User { get; set; }

        // true -> фронт обязан увести пользователя на смену пароля до любой другой работы.
        public bool ForceChangePassword { get; set; }
    }
}
