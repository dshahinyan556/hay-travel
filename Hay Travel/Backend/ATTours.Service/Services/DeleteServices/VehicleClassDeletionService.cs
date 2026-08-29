using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.DeleteServices
{
    // Удаление класса авто. «В использовании» -> CatalogEntryInUse, как в TagDeletionService.
    // Использованием считаются все три ссылки на справочник: цена трансфера, строка заказа и
    // желаемый класс кастомной заявки. Все три FK настроены Restrict — без этой проверки
    // клиент получил бы вместо 400 невнятную ошибку БД. Класс, который больше не продаётся,
    // но уже участвовал в заказах, скрывается флагом IsActive, а не удаляется.
    public class VehicleClassDeletionService : RepositoryCoreBase<VehicleClass, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public VehicleClassDeletionService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task DeleteAsync(int id)
        {
            var vehicleClass = await EntityRepository.AsQueryable()
                                                     .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                               ?? throw new ErrorModelException(GlobalErrorCode.VehicleClassNotFound, HttpStatusCode.NotFound,
                                   $"Vehicle class with id {id} not found.");

            var usedInTransferPrices = await Context.Set<TransferPrice>()
                                                    .AnyAsync(price => price.VehicleClassId == id, cancellationToken);
            var usedInOrderLines = await Context.Set<OrderLine>()
                                                .AnyAsync(line => line.VehicleClassId == id, cancellationToken);
            var usedInCustomTransfers = await Context.Set<CustomTransferDetails>()
                                                     .AnyAsync(details => details.DesiredVehicleClassId == id, cancellationToken);

            if (usedInTransferPrices || usedInOrderLines || usedInCustomTransfers)
                throw new ErrorModelException(GlobalErrorCode.CatalogEntryInUse, HttpStatusCode.BadRequest,
                    $"Vehicle class with id {id} is used by a transfer or an order and cannot be deleted.");

            EntityRepository.Delete(vehicleClass);
            await EntityRepository.SaveChangesAsync(cancellationToken);
        }
    }
}
