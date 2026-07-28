using ATTours.Helper.ErrorModels;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using System.Net.Mime;

namespace ATTours.Helper.ResponseBuilders
{
    public class HttpJsonResponseBuilder<TModel>(HttpResponse httpResponse) : HttpResponseExceptionBuilderBase<TModel>(httpResponse)
        where TModel : IHttpResponseStatus
    {
        protected override string MediaType => MediaTypeNames.Application.Json;

        protected override string Serialize(TModel model)
        {
           return JsonConvert.SerializeObject(model);
        }
    }
}
