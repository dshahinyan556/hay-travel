using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение пользователей для админки. Роль включена всегда: UserInfoModel отдаёт
    // RoleType, а не только RoleId.
    public class UserInfo : EntityInfoBase<User>
    {
        public UserInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public UserInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
        }

        public UserInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
        }

        // !IsDeleted (B4/B13, 2026-08-06): единственное место, от которого наследуют и
        // список (GetAllAsync/GetUsersAsync), и деталь (GetByIdAsync) — без этого фильтра
        // soft-delete был бы косметическим, удалённые пользователи оставались бы в UI.
        //
        // Where() после Include() возвращает суженный IQueryableRepository<User> (интерфейс
        // не покрывает ковариантный возврат) — вызываем ради побочного эффекта (мутирует тот
        // же LocalEntities) и возвращаем исходную includable-ссылку, не результат вызова.
        protected override IEntityQueryableRepository<User> GetEntityQueryableRepository()
        {
            var repository = base.GetEntityQueryableRepository().Include(x => x.Role);
            repository.Where(x => !x.IsDeleted);
            return repository;
        }

        public async Task<User> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await GetEntityQueryableRepository().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        }
    }
}
