using System;
using System.Collections.Concurrent;

namespace ATTours.Helper.Security
{
    // In-memory реализация (David, 2026-08-31) — тот же приём, что AccessTokenRevocationRegistry,
    // корректный ровно потому, что деплой одноинстансный (docker-compose.yml, один backend-
    // контейнер): словарь процессный, разъезжаться ему не с кем.
    //
    // Регистрируется СИНГЛТОНОМ — иначе у каждого запроса была бы своя пустая таблица и
    // отзыв не сработал бы вовсе.
    public class SessionRevocationRegistry : ISessionRevocationRegistry
    {
        private readonly record struct RevocationEntry(DateTime CutoffUtc, DateTime EntryExpiresUtc);

        private readonly ConcurrentDictionary<string, RevocationEntry> entries = new();

        public bool IsEmpty => entries.IsEmpty;

        public void Revoke(string sessionTokenHash, DateTime cutoffUtc, DateTime entryExpiresUtc)
        {
            var incoming = new RevocationEntry(cutoffUtc, entryExpiresUtc);

            // Повторный отзыв той же сессии (маловероятно — RevokeSessionAsync уже
            // идемпотентен на уровне RefreshToken.RevokedAtUtc): побеждает более поздний
            // cutoff, вместе с ним берётся его же срок жизни записи.
            entries.AddOrUpdate(sessionTokenHash, incoming,
                (_, existing) => existing.CutoffUtc >= incoming.CutoffUtc ? existing : incoming);

            SweepExpired();
        }

        public bool IsRevoked(string sessionTokenHash, DateTime tokenIssuedAtUtc)
        {
            if (!entries.TryGetValue(sessionTokenHash, out var entry))
                return false;

            if (DateTime.UtcNow >= entry.EntryExpiresUtc)
            {
                entries.TryRemove(sessionTokenHash, out _);
                return false;
            }

            return tokenIssuedAtUtc < entry.CutoffUtc;
        }

        // Оппортунистическая уборка на записи: писателей немного (отзыв сессий, не каждый
        // запрос), фоновый таймер здесь был бы дороже самой задачи.
        private void SweepExpired()
        {
            var now = DateTime.UtcNow;
            foreach (var pair in entries)
            {
                if (now >= pair.Value.EntryExpiresUtc)
                    entries.TryRemove(pair.Key, out _);
            }
        }
    }
}
