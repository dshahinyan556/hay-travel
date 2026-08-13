using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Правило закрытия дней для брони (ADR 012). В БД лежит именно ПРАВИЛО, а не
    // материализованные даты: «все понедельники» — одна строка, принадлежность конкретного
    // дня закрытию вычисляет ClosureRuleResolver в слое Service.
    //
    // Мультиязычности нет: единственная строка Reason — внутренняя админ-заметка,
    // пользователю она не показывается.
    [EntityTypeConfiguration(typeof(ClosureRuleConfiguration))]
    public class ClosureRule : EntityBase
    {
        // null = глобальное правило (все туры); заполнено = правило конкретного тура.
        public int? TourId { get; set; }
        public Tour Tour { get; set; }

        public ClosureRuleType Type { get; set; }

        public ClosureAction Action { get; set; }

        // Заполнено при Type == SpecificDate.
        public DateOnly? Date { get; set; }

        // Заполнено при Type == Weekly. Системный System.DayOfWeek (Sunday=0..Saturday=6),
        // хранится int — своего enum дней недели не заводим.
        public DayOfWeek? DayOfWeek { get; set; }

        // Необязательные границы действия recurring-правила (включительно, null = без границы).
        public DateOnly? EffectiveFrom { get; set; }
        public DateOnly? EffectiveTo { get; set; }

        // Необязательная внутренняя заметка админа («ремонт автобуса»), не перевод.
        public string Reason { get; set; }
    }
}
