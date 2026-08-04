using ATTours.Common.DTO.Auth;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace ATTours.BusinessServices.Security
{
    // Access-токен подписывается HS256 ключом из секции Jwt. Refresh-токен — просто
    // 256 бит энтропии: он ничего не «несёт», это указатель на строку RefreshToken.
    public class JwtTokenService : IJwtTokenService
    {
        private const int RefreshTokenBytes = 32;

        private readonly JwtSettings settings;
        private readonly SigningCredentials signingCredentials;

        public JwtTokenService() : this(JwtSettings.Instance)
        {
        }

        public JwtTokenService(JwtSettings settings)
        {
            this.settings = settings;

            // Ключ читается один раз, при создании сервиса: незаданный SigningKey бросает
            // из JwtSettings осмысленное исключение, а не выдаёт токены неподписанными.
            var keyBytes = Encoding.UTF8.GetBytes(settings.SigningKey);
            signingCredentials = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);
        }

        public AccessTokenModel CreateAccessToken(User user)
        {
            var expiresInSeconds = settings.AccessTokenMinutes * 60;
            var issuedAtUtc = DateTime.UtcNow;

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(JwtRegisteredClaimNames.UniqueName, user.Username),
                new(JwtRegisteredClaimNames.Email, user.Email),
                // Роль обязана быть загружена вызывающим (Include(Role)) — без неё
                // токен молча оказался бы без прав.
                new(ClaimTypes.Role, user.Role.Type.ToString())
            };

            var token = new JwtSecurityToken(
                issuer: settings.Issuer,
                audience: settings.Audience,
                claims: claims,
                notBefore: issuedAtUtc,
                expires: issuedAtUtc.AddSeconds(expiresInSeconds),
                signingCredentials: signingCredentials);

            return new AccessTokenModel
            {
                AccessToken = new JwtSecurityTokenHandler().WriteToken(token),
                ExpiresInSeconds = expiresInSeconds
            };
        }

        public GeneratedRefreshToken CreateRefreshToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(RefreshTokenBytes);
            // Base64Url: токен едет в cookie и (при dev-сценариях) в URL — без '+', '/' и '='.
            var token = Base64UrlEncoder.Encode(bytes);

            return new GeneratedRefreshToken(
                token,
                HashRefreshToken(token),
                DateTime.UtcNow.AddDays(settings.RefreshTokenDays));
        }

        public string HashRefreshToken(string token)
        {
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            return Convert.ToHexString(hash);
        }
    }
}
