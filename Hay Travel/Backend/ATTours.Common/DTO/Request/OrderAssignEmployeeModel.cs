using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Request
{
    // Назначение исполнителей. LineId == null — bulk-действие "на все строки" (Давид,
    // 2026-08-16); LineId задан — назначение на конкретную строку.
    //
    // Семантика — АДДИТИВНЫЙ upsert, а не «заменить набор исполнителей»: не перечисленные
    // в запросе исполнители не снимаются (для этого есть UnassignEmployee с конкретным
    // EmployeeId). Обоснование: bulk-режим с replace-семантикой одним неосторожным
    // сохранением стёр бы разных исполнителей по всем строкам заказа, и откатить это нечем.
    public class OrderAssignEmployeeModel
    {
        public int OrderId { get; set; }

        // null = на все строки заказа.
        public int? LineId { get; set; }

        // Мультивыбор попапа: список людей, у каждого своя роль. Пустой список — 400.
        public List<OrderAssignEmployeeItem> Employees { get; set; } = [];

        // Тихое назначение (Давид, 2026-08-21): попап разводит «Назначить» (без письма) и
        // «Назначить и отправить письмо». Письмо уходит ⟺ намерение И включённый канал.
        public bool SendEmail { get; set; } = true;
    }

    public class OrderAssignEmployeeItem
    {
        public int EmployeeId { get; set; }

        // Обязательна (Задача D): назначения без роли не существует. Non-nullable —
        // отсутствие поля в запросе приедет как 0, а 0 не входит в enum, и сервис
        // отобьёт его как EmployeeRoleRequired.
        public EmployeeJobRole EmployeeRole { get; set; }
    }
}
