using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ATTours.DataLayer.Migrations
{
    /// <inheritdoc />
    public partial class SeedAdminUser : Migration
    {
        // Стартовый администратор: без него ни один эндпоинт под [Authorize(Roles = "Admin")]
        // недостижим, а самостоятельная регистрация выдаёт только роль Regular.
        //
        // Пароль хранится единственным способом, которым он вообще может храниться —
        // BCrypt-хешем (work factor 12), тем же, что выдаёт BCryptPasswordHasher.
        // Plaintext в репозитории не фиксируется и передан отдельно; после первого входа
        // его следует сменить через POST api/Auth/ChangePassword.
        //
        // Id не задаётся явно: строка вставляется identity-колонкой, а Down удаляет её
        // по Username — миграция не зависит ни от IDENTITY_INSERT, ни от занятых Id.
        private const string AdminUsername = "admin";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "User",
                columns: new[]
                {
                    "FirstName", "LastName", "Username", "Email", "PhoneNumber", "Password",
                    "IsEmailVerified", "FailedLoginAttempts", "LockedUntil", "ForceToChangePass", "RoleId"
                },
                values: new object[]
                {
                    "Admin",
                    null,
                    AdminUsername,
                    "admin@haytravel.local",
                    "37400000000",
                    "$2a$12$Q6wo4EJGLidHjAdHpEc4OOyglzqzqT9Po/ohjFp9uMbRj3JcoLQIO",
                    true,
                    0,
                    null,
                    false,
                    // RoleId = 3 -> RoleType.Admin, засеяно UserRoleConfiguration.HasData.
                    3
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "User",
                keyColumn: "Username",
                keyValue: AdminUsername);
        }
    }
}
