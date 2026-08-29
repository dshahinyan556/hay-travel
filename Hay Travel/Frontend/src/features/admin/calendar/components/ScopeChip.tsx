export interface ScopeChipProps {
  label: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}

/**
 * Пилюля-переключатель для выбора области закрытия: продукт, тип продукта, регион-пресет.
 *
 * Раньше жила локально в `DayClosureControls` под именем `ToggleChip` (2026-08-14, вместо списка
 * чекбоксов): заливка «в цвет» читается с одного взгляда, когда в дне больше пары продуктов, и
 * снимает старую двусмысленность «ничего не отмечено» = «я ещё не решил». С появлением области
 * «тип продукта» (решение 0.27) тот же элемент понадобился и в панели массовых операций —
 * поэтому вынесен в свой файл, а не скопирован вторым экземпляром.
 *
 * Остаётся ЛОКАЛЬНЫМ компонентом календаря, а не `shared/ui`: за пределами этого экрана
 * chip-переключателей в админке нет, а `shared/ui/Checkbox` решает другую задачу.
 */
export function ScopeChip({ label, selected, disabled, onClick }: ScopeChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`cursor-pointer rounded-full border px-3 py-1.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? 'border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800'
          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      {label}
    </button>
  )
}
