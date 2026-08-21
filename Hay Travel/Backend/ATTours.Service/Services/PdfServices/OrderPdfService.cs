using ATTours.Common.DTO.Info;
using ATTours.Common.Enums;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Globalization;

namespace ATTours.BusinessServices.Services.PdfServices
{
    // Генерация PDF заказа (Фаза 4, checklist-orders-redesign.txt). Сознательно работает с уже
    // собранным OrderInfoModel, а не с сущностью Order: денормализация (TourTitle/
    // EmployeeFullName/UserFullName, агрегаты DiscountTotal/Total) уже сделана мапером — это
    // ровно то же, что видит админ на экране заказа, повторно резолвить незачем.
    public static class OrderPdfService
    {
        private static readonly CultureInfo Culture = new("ru-RU");

        // Весь заказ — вложение к письму клиенту при "Отправить заказ" (Фаза 5.1).
        public static byte[] GenerateOrderDocument(OrderInfoModel order)
            => Build(order, order.Lines, isAssignment: false);

        // Только указанные строки (обычно одна) — вложение к письму исполнителю при
        // "Назначить и отправить" (Фаза 5.2), плюс "Детали для выполнения" по каждой строке.
        public static byte[] GenerateAssignmentDocument(OrderInfoModel order, IReadOnlyCollection<int> lineIds)
        {
            var lines = order.Lines.Where(line => lineIds.Contains(line.Id)).ToList();
            return Build(order, lines, isAssignment: true);
        }

        private static byte[] Build(OrderInfoModel order, IReadOnlyCollection<OrderLineInfoModel> lines, bool isAssignment)
        {
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(2, Unit.Centimetre);
                    page.DefaultTextStyle(style => style.FontSize(10));

                    page.Header().Column(column =>
                    {
                        column.Item().Text($"Заказ № {order.Number}").FontSize(18).SemiBold();
                        if (isAssignment)
                            column.Item().Text("Задание исполнителю").FontSize(12).FontColor(Colors.Grey.Darken1);
                    });

                    page.Content().PaddingTop(10).Column(column =>
                    {
                        column.Spacing(12);
                        column.Item().Element(c => ComposeMeta(c, order));

                        foreach (var line in lines)
                            column.Item().Element(c => ComposeLine(c, line, order.Currency, isAssignment));

                        if (!isAssignment)
                            column.Item().Element(c => ComposeTotals(c, order));
                    });

                    page.Footer().AlignCenter().Text(text =>
                    {
                        text.CurrentPageNumber();
                        text.Span(" / ");
                        text.TotalPages();
                    });
                });
            });

            return document.GeneratePdf();
        }

        private static void ComposeMeta(IContainer container, OrderInfoModel order)
        {
            container.Column(column =>
            {
                column.Spacing(2);
                column.Item().Text($"Дата создания: {order.CreatedAtUtc:dd.MM.yyyy HH:mm}");
                column.Item().Text($"Статус: {ResolveStatusLabel(order.Status)}");
                if (!string.IsNullOrWhiteSpace(order.RejectReason))
                    column.Item().Text($"Причина отклонения: {order.RejectReason}");
                column.Item().Text($"Клиент: {order.UserFullName} ({order.UserEmail})");
            });
        }

        private static void ComposeLine(IContainer container, OrderLineInfoModel line, string currency, bool isAssignment)
        {
            container.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Column(column =>
            {
                column.Spacing(3);
                column.Item().Text(line.TourTitle ?? $"Тур #{line.TourId}").SemiBold();
                column.Item().Text($"Дата: {line.TourDate:dd.MM.yyyy}   Гостей: {line.GuestCount}");

                if (isAssignment)
                {
                    if (!string.IsNullOrWhiteSpace(line.PickupDetails))
                        column.Item().Text($"Место встречи: {line.PickupDetails}");
                    if (!string.IsNullOrWhiteSpace(line.NavigatorLink))
                        column.Item().Text($"Навигатор: {line.NavigatorLink}");
                }
                else
                {
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Text($"Цена: {FormatAmount(line.PriceSnapshot, currency)}");
                        row.RelativeItem().Text(line.DiscountPercent is > 0
                            ? $"Скидка: {line.DiscountPercent}%"
                            : "Скидка: —");
                        row.RelativeItem().Text($"Итого: {FormatAmount(line.LineTotal, currency)}");
                    });

                    if (line.RequiresPrepayment)
                        column.Item().Text($"Предоплата: {FormatAmount(line.PrepaymentAmount, currency)}");

                    if (!string.IsNullOrWhiteSpace(line.EmployeeFullName))
                        column.Item().Text($"Исполнитель: {line.EmployeeFullName}");
                }
            });
        }

        private static void ComposeTotals(IContainer container, OrderInfoModel order)
        {
            container.AlignRight().Column(column =>
            {
                column.Spacing(2);
                if (order.DiscountTotal > 0)
                    column.Item().Text($"Скидка всего: {FormatAmount(order.DiscountTotal, order.Currency)}");
                column.Item().Text($"Итого по заказу: {FormatAmount(order.Total, order.Currency)}").SemiBold().FontSize(12);
            });
        }

        private static string FormatAmount(decimal amount, string currency) => $"{amount.ToString("N0", Culture)} {currency}";

        private static string ResolveStatusLabel(OrderStatus status) => status switch
        {
            OrderStatus.Open => "Открыт",
            OrderStatus.Hold => "На удержании",
            OrderStatus.Approved => "Подтверждён",
            OrderStatus.Rejected => "Отклонён",
            OrderStatus.ReadyForAssignment => "Готов к назначению",
            OrderStatus.PendingPayment => "Ожидает предоплаты",
            OrderStatus.Completed => "Выполнен",
            _ => status.ToString()
        };
    }
}
