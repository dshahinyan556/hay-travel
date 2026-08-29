using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;

namespace ATTours.BusinessServices.Security
{
    // Одноразовые email-токены (verify/reset). Хранятся в UserToken.Token как есть:
    // в отличие от refresh-токена, они живут час, гасятся при первом использовании
    // и участвуют в unique-индексе.
    public static class RandomTokenGenerator
    {
        private const int TokenBytes = 32;

        private const int DeepLinkCodeBytes = 18;

        public static string Create() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(TokenBytes));

        // Числовой код для ручного ввода (email-change flow, B8): 32-байтный Create() непригоден
        // для UI-поля "введите код, который прислали на почту". Каждая цифра — независимый
        // равномерный GetInt32(0, 10), без modulo-bias.
        public static string CreateNumericCode(int length)
        {
            var digits = new char[length];
            for (var i = 0; i < length; i++)
                digits[i] = (char)('0' + RandomNumberGenerator.GetInt32(0, 10));

            return new string(digits);
        }

        // Deep-link-код Telegram (?start=<payload>, ADR 031 §4): алфавит base64url
        // [A-Za-z0-9_-] совместим с ограничениями Telegram (только эти символы, ≤64).
        // 18 байт -> ровно 24 символа без паддинга, поэтому Create() (32 байта -> 43)
        // здесь не переиспользуется.
        public static string CreateDeepLinkCode() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(DeepLinkCodeBytes));
    }
}
