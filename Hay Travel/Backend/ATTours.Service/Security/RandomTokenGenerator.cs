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

        public static string Create() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(TokenBytes));
    }
}
