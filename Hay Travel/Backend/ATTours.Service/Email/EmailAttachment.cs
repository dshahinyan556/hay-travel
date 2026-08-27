namespace ATTours.BusinessServices.Email
{
    // Вложение транзакционного письма. Отдельный тип вместо пары (byte[], string) в
    // сигнатуре: вложение либо есть целиком, либо его нет — половинчатое состояние
    // "контент без имени файла" не должно быть выразимо.
    public class EmailAttachment
    {
        public EmailAttachment(string fileName, byte[] content)
        {
            FileName = fileName;
            Content = content;
        }

        public string FileName { get; }

        public byte[] Content { get; }
    }
}
