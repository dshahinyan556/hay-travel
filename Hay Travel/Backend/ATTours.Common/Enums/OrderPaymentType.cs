namespace ATTours.Common.Enums
{
    // Тип строки в денежном журнале заказа (OrderPayment, после переделки B14 — список
    // проводок, не снапшот "заказ/деньги 1:1", см. ADR 015).
    public enum OrderPaymentType
    {
        Prepayment = 1,
        Payment = 2
    }
}
