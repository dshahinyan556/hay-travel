/**
 * Тумблер канала уведомлений.
 *
 * Тумблер, а не галочка, потому что у канала два состояния и МГНОВЕННОЕ последствие: это не пункт
 * формы, который «применится при сохранении» (кнопки «Сохранить» в разделе нет — тема и палитра
 * применяются на глазах, и кнопка после уже случившегося изменения выглядела бы враньём).
 *
 * `role="switch"` + `aria-checked` — ровно тот случай, для которого роль и заведена: включено или
 * выключено, без третьего состояния. `<input type="checkbox">` здесь пришлось бы прятать и рисовать
 * поверх псевдоэлементами, а читался бы он всё равно как «отметка в форме».
 */

export interface PreferenceSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Имя контрола для скринридера — «Email», «Telegram». Видимая подпись стоит слева и связать её
   *  с кнопкой нечем, кроме этого. */
  label: string
}

export function PreferenceSwitch({
  checked,
  onChange,
  disabled = false,
  label,
}: PreferenceSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // Видимый трек 44×24, зона нажатия доведена до 44×44 невидимым `before:` — растить сам трек
      // ради этого значило бы нарисовать тумблер размером с кнопку.
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)]',
        "before:absolute before:-inset-y-2.5 before:-inset-x-1 before:content-['']",
        'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-45',
        checked ? 'bg-gold-fill' : 'bg-edge-strong',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'pointer-events-none block size-[18px] rounded-full transition-transform duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)]',
          checked ? 'translate-x-[23px] bg-gold-on' : 'translate-x-[3px] bg-page',
        ].join(' ')}
      />
    </button>
  )
}
