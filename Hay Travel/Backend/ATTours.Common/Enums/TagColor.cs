namespace ATTours.Common.Enums
{
    // Ровно 5 preset-токенов сайтовой палитры (obsidian/gold + семантические success/danger/
    // warning) — не произвольный hex, чтобы новый тег гарантированно читался в обеих темах
    // без ручной проверки контраста на каждый цвет.
    public enum TagColor
    {
        Gold = 1,
        Wine = 2,
        Success = 3,
        Danger = 4,
        Warning = 5
    }
}
