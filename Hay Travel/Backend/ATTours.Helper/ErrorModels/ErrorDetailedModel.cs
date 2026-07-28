using Newtonsoft.Json;

namespace ATTours.Helper.ErrorModels
{
    public class ErrorDetailedModel : ErrorModel
    {
        [JsonProperty("code")]
        public int Code { get; set; }
        [JsonProperty("title")]
        public string Title { get; set; }
    }
}
