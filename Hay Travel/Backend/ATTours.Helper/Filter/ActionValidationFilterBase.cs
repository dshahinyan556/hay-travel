using ATTours.Helper.Attributes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ATTours.Helper.Filter
{
    public abstract class ActionValidationFilterBase : IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            if (IsDisabled(context))
            {
                await next();
                return;
            }

            await OnEnabledExecutionAsync(context, next);
        }

        protected abstract Task OnEnabledExecutionAsync( ActionExecutingContext context, ActionExecutionDelegate next);

        private bool IsDisabled(ActionExecutingContext context)
        {
            return context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<DisableActionValidationFiltersAttribute>() != null;
        }
    }
}
