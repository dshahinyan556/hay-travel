namespace ATTours.BusinessServices.Security
{
    // Односторонний хеш пароля. Отдельная абстракция, чтобы алгоритм (и его work factor)
    // не был зашит в бизнес-логику AuthService.
    public interface IPasswordHasher
    {
        string Hash(string password);

        // Не бросает на мусорном/пустом хеше — возвращает false: сравнение пароля
        // не должно отличать «нет пользователя» от «битая строка в БД».
        bool Verify(string password, string hash);
    }
}
