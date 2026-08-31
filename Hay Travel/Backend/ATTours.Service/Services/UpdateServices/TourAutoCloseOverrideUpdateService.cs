using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Сохранение набора исключений из порога автозакрытия (батч 2026-08-29): таблица
    // «Исключения по продуктам» на карточке задачи «Автозакрытие дат» уезжает на сервер
    // целиком и одним запросом.
    //
    // Полная замена, а не add/edit/delete по строке — тот же приём, что у
    // NotificationSettingsUpdateService.SyncRecipientsAsync и UsersController.
    // PutPermissionOverrides: экран это редактируемый грид с одной кнопкой «Сохранить», и
    // набор частичных операций пришлось бы собирать на клиенте, сравнивая черновик с
    // исходным состоянием — то есть повторять на фронте то, что и так делает этот метод.
    //
    // Идентичность строки — TourId, а не Id: клиент присылает «у этого продукта столько-то
    // часов» и ключей таблицы не знает (та же логика, что у SiteSettingsUpdateService,
    // сверяющего настройки по Key).
    public class TourAutoCloseOverrideUpdateService : RepositoryCoreBase<TourAutoCloseOverride, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public TourAutoCloseOverrideUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        // Список nullable сознательно: тело PUT без поля overrides (и вовсе пустое тело)
        // приезжает сюда как null, и это тот же смысл, что пустой список — «исключений
        // больше нет». DTO живёт в ATTours.Common, где nullable выключен, поэтому отсечь
        // такой вход типом на границе контроллера нельзя.
        public async Task ReplaceAsync(List<AutoCloseOverrideUpdateModel>? overrides)
        {
            // Пустой (и даже отсутствующий) список — легальный вход: «исключений больше
            // нет». Это НЕ тот случай, что у PATCH параметров задачи, где пустое тело почти
            // наверняка ошибка клиента: там запрос частичный, а здесь — замена набора.
            var incoming = overrides ?? [];

            var existing = await EntityRepository.AsQueryable().ToListAsync(cancellationToken);

            var targets = new List<TourAutoCloseOverride>();
            var created = new List<TourAutoCloseOverride>();

            foreach (var row in incoming)
            {
                var target = existing.FirstOrDefault(entity => entity.TourId == row.TourId);

                if (target is null)
                {
                    target = new TourAutoCloseOverride { TourId = row.TourId };
                    created.Add(target);
                }

                target.LeadTimeHours = row.LeadTimeHours;
                targets.Add(target);
            }

            // Валидация ДО любых изменений графа: отклонённый запрос не должен оставить
            // после себя ни удалённых строк, ни добавленных. Дубль в запросе виден именно
            // здесь — в targets он даёт две записи с одним TourId (одну и ту же строку,
            // упомянутую дважды, либо два свежесозданных объекта).
            await new TourAutoCloseOverrideValidationService(targets, Context).ValidateEntitiesAsync();

            // Строки, которых во входном наборе нет, удаляются: исключение снимают, убирая
            // строку из таблицы на экране, а не проставляя ей ноль часов.
            foreach (var stale in existing.Where(entity => incoming.All(row => row.TourId != entity.TourId)))
                EntityRepository.Delete(stale);

            foreach (var entity in created)
                await EntityRepository.AddAsync(entity, cancellationToken);

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
