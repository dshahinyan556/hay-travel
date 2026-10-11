/**
 * Классы кнопок ПУБЛИЧНОЙ темы — четыре роли из мокапа кабинета, собранные в одном месте.
 *
 * Почему не `shared/ui/Button`: он на админской палитре (`bg-neutral-950`) и на обсидиане
 * выглядел бы чужим — тот же довод, что у `OrderStatusPill` против `OrderStatusBadge`. Публичные
 * кнопки в проекте уже пишутся утилитами по месту (`AuthSubmitButton`, кнопки `SessionsSection`);
 * здесь их четыре роли и три раздела, и три копии одной пилюли разъехались бы.
 *
 * Функция, а не компонент: те же классы нужны и `<button>`, и `<Link>` (в пустом состоянии
 * «Смотреть туры» — это переход, а не действие, и обязан быть ссылкой).
 *
 * Переехал сюда из `features/auth/account/lib/accountButton.ts` вместе с выносом блока контактов
 * в `shared/contacts` (батч 2026-08-29): карточка и форма контакта им пользуются, а `shared` не
 * может импортировать `features`. Второй набор тех же классов рядом с первым — ровно то
 * расхождение, ради устранения которого блок и выносился. Кабинет продолжает звать функцию как
 * `accountButtonClass` через тонкий реэкспорт на прежнем пути.
 *
 * ── Высота ───────────────────────────────────────────────────────────────────────────────────
 * Даже `sm` держит 44 px по высоте, хотя в мокапе у мелких кнопок 36. Мокап сжимал их ради
 * ГОРИЗОНТАЛЬНОЙ укладки трёх действий в строке контакта — от высоты это не зависит, а зона
 * нажатия меньше 44 px на телефоне промахивается. Уменьшены только шрифт и горизонтальные поля,
 * то есть ровно то, что решало исходную задачу.
 */

export type PublicButtonVariant = 'gold' | 'ghost' | 'quiet' | 'danger'

const BASE =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-center font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed'

const SIZE: Record<'md' | 'sm', string> = {
  md: 'px-5 py-2.5 text-sm',
  sm: 'px-3.5 py-2 text-[13px]',
}

const VARIANT: Record<PublicButtonVariant, string> = {
  gold: 'bg-gold-fill text-gold-on hover:bg-gold-fill-hover disabled:bg-disabled-bg disabled:text-disabled-ink',
  ghost: 'text-ink-dim ring-1 ring-edge-strong ring-inset hover:text-gold-ink disabled:opacity-60',
  quiet: 'text-ink-muted hover:text-danger disabled:opacity-60',
  danger: 'text-danger ring-1 ring-danger ring-inset hover:bg-danger-soft disabled:opacity-60',
}

export function publicButtonClass(
  variant: PublicButtonVariant,
  size: 'md' | 'sm' = 'md',
  extra = '',
): string {
  return `${BASE} ${SIZE[size]} ${VARIANT[variant]} ${extra}`.trim()
}
