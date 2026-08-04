namespace ATTours.BusinessServices.Security
{
    public class BCryptPasswordHasher : IPasswordHasher
    {
        // 12 раундов — актуальный компромисс «цена перебора / задержка входа» (~250мс).
        private const int WorkFactor = 12;

        public string Hash(string password)
            => BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

        public bool Verify(string password, string hash)
        {
            if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(hash))
                return false;

            try
            {
                return BCrypt.Net.BCrypt.Verify(password, hash);
            }
            catch (BCrypt.Net.SaltParseException)
            {
                // Строка в колонке Password не является BCrypt-хешем (например, данные,
                // залитые в обход сервиса). Это неверные учётные данные, а не 500.
                return false;
            }
        }
    }
}
