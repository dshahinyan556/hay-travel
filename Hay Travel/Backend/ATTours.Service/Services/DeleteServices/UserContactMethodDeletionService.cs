using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Удаление своей строки справочника способов связи (батч 2026-08-29).
    //
    // Проверки «в использовании» (CatalogEntryInUse) здесь НЕТ и быть не должно: заказы
    // держат СНИМОК значений и от этой таблицы не зависят (ADR 032 Р1). По той же причине
    // удаление физическое, а не soft-delete — второго IsDeleted-флага в системе не заводим.
    public class UserContactMethodDeletionService : RepositoryCoreBase<UserContactMethod, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public UserContactMethodDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id, int userId)
        {
            // userId в предикате обязателен: без него это был бы «удали любой контакт по id».
            var contact = await EntityRepository.AsQueryable()
                                                .SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
                          ?? throw new ErrorModelException(GlobalErrorCode.ContactMethodNotFound, HttpStatusCode.NotFound,
                              $"Contact method with id {id} not found.");

            EntityRepository.Delete(contact);

            // Удалили основной — основной переезжает на первую оставшуюся строку по Id:
            // профиль не должен остаться без основного, иначе форме заказа нечем
            // предзаполняться. Переназначение уезжает тем же SaveChanges, что и удаление.
            if (contact.IsPrimary)
            {
                var replacement = await Context.Set<UserContactMethod>()
                                               .Where(x => x.UserId == userId && x.Id != id)
                                               .OrderBy(x => x.Id)
                                               .FirstOrDefaultAsync(cancellationToken);

                if (replacement is not null)
                    replacement.IsPrimary = true;
            }

            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
