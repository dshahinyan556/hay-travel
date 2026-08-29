namespace ATTours.Common.DTO.Info
{
    // Ответ на «Запустить сейчас». Результата самого прогона здесь нет и быть не может:
    // задача уходит в очередь планировщика, а её исход читается из истории
    // (GET api/Jobs/{key}/Runs) — эндпоинт отвечает 202, а не 200.
    public class JobRunTriggerResultModel
    {
        // false — задача в очередь НЕ поставлена (уже идёт прогон), ответ 409.
        public bool Accepted { get; set; }

        // Причина отказа по-русски, для тоста в админке. null при Accepted = true.
        public string Reason { get; set; }

        // GlobalErrorCode отказа числом. Отдаётся в теле, а не только через общий
        // обработчик ошибок, потому что тело здесь — доменный результат операции, а не
        // ErrorModel: фронту нужен и машиночитаемый код, и Accepted одним объектом.
        // null при Accepted = true.
        public int? ErrorCode { get; set; }
    }
}
