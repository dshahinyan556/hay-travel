using System.Transactions;

namespace ATTours.ContextRepository.Helpers
{
    public static class TransactionsHelper
    {
        public static TransactionScope CreateTransactionScope()
            => new(TransactionScopeOption.Required);

        public static TransactionScope CreateAsyncTransactionScope()
            => new(TransactionScopeAsyncFlowOption.Enabled);
    }
}
