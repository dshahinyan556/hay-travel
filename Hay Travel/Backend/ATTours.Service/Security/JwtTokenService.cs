using ATTours.Common.Authorization;
using ATTours.Common.DTO.Auth;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using Microsoft.IdentityModel.Tokens;
using System.Globalization;
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

        public AccessTokenModel CreateAccessToken(User user, ResolvedPermissionSet permissions, int? impersonatedByUserId = null)
        {
            var expiresInSeconds = settings.AccessTokenMinutes * 60;
            var issuedAtUtc = DateTime.UtcNow;

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(JwtRegisteredClaimNames.UniqueName, user.Username),
                new(JwtRegisteredClaimNames.Email, user.Email),
                // iat выставляется ЯВНО и является load-bearing (ADR 030 / spec 014 §8.9):
                // мгновенный отзыв после impersonation отличает старый токен от свежего
                // ровно по нему. Конструктор JwtSecurityToken(..., notBefore, expires, ...)
                // сам кладёт только nbf/exp — проверено на выпущенном токене, поэтому
                // полагаться на «библиотека добавит» здесь нельзя.
                new(JwtRegisteredClaimNames.Iat,
                    EpochTime.GetIntDate(issuedAtUtc).ToString(CultureInfo.InvariantCulture),
                    ClaimValueTypes.Integer64)
            };

            // Роль обязана быть загружена вызывающим (Include(Role)). Role-claim добавляется
            // только у СИСТЕМНОЙ роли (Type != null): у кастомной роли его нет, и это верно —
            // жёсткие [Authorize(Roles=Admin/Employee)] остались только на мета-экранах и
            // Employee-эндпоинте, всё остальное гейтится матрицей прав (§2.6).
            if (user.Role?.Type is not null)
                claims.Add(new Claim(ClaimTypes.Role, user.Role.Type.Value.ToString()));

            // Права печём в токен один раз, при его выпуске: на каждый запрос БД не трогаем,
            // [RequiresPermission] читает эти два claim'а (§0.2, §2.6). Изменение матрицы
            // применяется на ближайшей ротации access-токена (<= его TTL).
            if (permissions is not null)
            {
                if (permissions.IsAdmin)
                    claims.Add(new Claim(PermissionClaims.IsAdminClaimType, PermissionClaims.TrueValue));

                var encoded = PermissionClaims.Encode(permissions);
                if (!string.IsNullOrEmpty(encoded))
                    claims.Add(new Claim(PermissionClaims.PermissionsClaimType, encoded));
            }

            // D6 (2026-08-09): свой собственный статус SuperAdmin приходит тем же каналом,
            // что и роль. Claim добавляется ТОЛЬКО когда он true — у обычного админа в токене
            // нет даже упоминания о существовании такого признака.
            //
            // Токен здесь — канал уведомления фронта (какие кнопки показывать), но не источник
            // истины для авторизации: сами guard'ы перечитывают IsSuperAdmin из БД.
            if (user.IsSuperAdmin)
                claims.Add(new Claim("is_super_admin", "true"));

            // «Войти как пользователь» (spec 014 §2.3): та же дисциплина present-only-when-true.
            // SuperAdmin получает право безусловно, не завися от матрицы своей роли.
            if (user.Role?.CanImpersonate == true || user.IsSuperAdmin)
                claims.Add(new Claim(PermissionClaims.CanImpersonateClaimType, PermissionClaims.TrueValue));

            // Сессия, созданная impersonation'ом: фронт по этому claim'у рисует баннер
            // «вы вошли как ...». Переживает ротацию через RefreshToken.ImpersonatedByUserId.
            if (impersonatedByUserId.HasValue)
                claims.Add(new Claim(PermissionClaims.ImpersonatedByClaimType,
                    impersonatedByUserId.Value.ToString(CultureInfo.InvariantCulture)));

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

        public GeneratedRefreshToken CreateRefreshToken(bool rememberMe)
        {
            var bytes = RandomNumberGenerator.GetBytes(RefreshTokenBytes);
            // Base64Url: токен едет в cookie и (при dev-сценариях) в URL — без '+', '/' и '='.
            var token = Base64UrlEncoder.Encode(bytes);

            // Окно скользящее: считается от «сейчас» и при выдаче, и на каждой ротации
            // (ADR 029). Без remember-me это и есть лимит неактивности — сессия, которая
            // столько не обновлялась, отвергается уже существующей проверкой ExpiresAtUtc.
            var lifetime = rememberMe
                ? TimeSpan.FromDays(settings.RefreshTokenDays)
                : TimeSpan.FromMinutes(settings.InactivityMinutes);

            return new GeneratedRefreshToken(
                token,
                HashRefreshToken(token),
                DateTime.UtcNow + lifetime);
        }

        public string HashRefreshToken(string token)
        {
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            return Convert.ToHexString(hash);
        }
    }
}
