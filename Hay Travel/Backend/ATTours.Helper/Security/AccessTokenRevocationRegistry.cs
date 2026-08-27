using System;
using System.Collections.Concurrent;

namespace ATTours.Helper.Security
{
    // In-memory реализация мгновенного отзыва (ADR 030). Корректна ровно потому, что
    // деплой одноинстансный (один backend-контейнер, без реплик — docker-compose.yml):
    // словарь процессный, и разъезжаться ему не с кем. При появлении второй реплики
    // реализацию нужно заменить на общий стор за тем же интерфейсом.
    //
    // Регистрируется СИНГЛТОНОМ — иначе у каждого запроса была бы своя пустая таблица
    // и отзыв не сработал бы вовсе.
    public class AccessTokenRevocationRegistry : IAccessTokenRevocationRegistry
    {
        // CutoffUtc — момент impersonation: токены с iat раньше него мертвы.
        // EntryExpiresUtc — когда запись сама становится бессмысленной (все такие токены
        // к этому времени протухли по своему TTL) и подлежит вычистке.
        private readonly record struct RevocationEntry(DateTime CutoffUtc, DateTime EntryExpiresUtc);

        private readonly ConcurrentDictionary<int, RevocationEntry> entries = new();

        // O(1), без блокировок: именно этим держится нулевая стоимость проверки в
        // атрибутах, пока никто не impersonate'ил.
        public bool IsEmpty => entries.IsEmpty;

        public void Revoke(int userId, DateTime cutoffUtc, DateTime entryExpiresUtc)
        {
            var incoming = new RevocationEntry(cutoffUtc, entryExpiresUtc);

            // Две impersonation подряд: побеждает более поздний cutoff (он строго шире
            // отзывает), и вместе с ним берётся его же срок жизни записи.
            entries.AddOrUpdate(userId, incoming,
                (_, existing) => existing.CutoffUtc >= incoming.CutoffUtc ? existing : incoming);

            SweepExpired();
        }

        public bool IsRevoked(int userId, DateTime tokenIssuedAtUtc)
        {
            if (!entries.TryGetValue(userId, out var entry))
                return false;

            // Ленивая вычистка на чтении: запись отжила своё — токенов с iat < Cutoff уже
            // не существует, удаляем и пропускаем.
            if (DateTime.UtcNow >= entry.EntryExpiresUtc)
            {
                entries.TryRemove(userId, out _);
                return false;
            }

            return tokenIssuedAtUtc < entry.CutoffUtc;
        }

        // Оппортунистическая уборка на записи: писателей единицы (только impersonation),
        // поэтому фоновый таймер здесь был бы дороже самой задачи.
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
