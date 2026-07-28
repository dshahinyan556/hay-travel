---
name: new-ui-component
description: Scaffold a new reusable UI primitive component in src/shared/ui (Button, Input, Modal, etc.) with proper variant props, states, and accessibility baked in. Use when a new base UI building block is needed, before implementing feature-specific UI.
---

# new-ui-component

Создаёт новый переиспользуемый компонент в дизайн-системе проекта (`src/shared/ui`),
по конвенциям `ui-ux-engineer`-агента.

## Шаги

1. Сначала проверь `src/shared/ui/` — нет ли уже похожего компонента. Если есть — расширь
   его вариантами, не создавай дубликат.
2. Имя компонента — `PascalCase`. Структура: `src/shared/ui/<Component>/`
   - `<Component>.tsx` — реализация
   - `<Component>.types.ts` — типы props (без `any`)
3. Вариативность через явные props — `variant`, `size` и т.п. — а не через хардкод одного
   вида использования.
4. Обязательные состояния, если применимо к типу компонента: `hover`, `focus` (видимый
   focus-ring), `active`, `disabled`, `loading`.
5. Доступность: семантический HTML-тег в основе, `aria-*` атрибуты там, где нужно
   (особенно для Modal/Dropdown/Tabs), поддержка клавиатурной навигации.
6. Никакой бизнес-логики конкретной фичи внутри — компонент должен работать в любом
   контексте приложения.
7. Экспортируй компонент из `src/shared/ui/index.ts`.
8. Если нужно визуальное решение (палитра/отступы) перед реализацией — сначала обратись к
   `designer`-агенту/скиллу `design-mockup`, не придумывай стиль самостоятельно.
