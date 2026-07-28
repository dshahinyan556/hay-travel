namespace ATTours.ContextRepository.Extensions
{
    internal static class ParserExtension
    {
        internal static TResult AsOrThrow<TResult>(this object value)
            where TResult : class
        {
            return value as TResult ?? throw new ArgumentException($"The provided model is not of type {nameof(TResult)}");
        }
    }
}
