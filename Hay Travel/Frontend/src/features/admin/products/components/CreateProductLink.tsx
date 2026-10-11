import { Link } from 'react-router'
import { AdminActionButton, Tooltip } from '@/shared/ui'
import { PlusIcon } from '@/shared/ui/icons'

/**
 * Visual copy of `AdminActionButton`'s `primary` + `md` look (`shared/ui/AdminActionButton.tsx`,
 * `variantClasses.primary` + `sizeClasses.md` + its base classes). Duplicated on purpose rather
 * than exported from `shared/ui`: «Создать продукт» NAVIGATES, so it must stay a real `<Link>` —
 * middle-click / open in a new tab keep working — and `AdminActionButton` only renders a
 * `<button>`. If the toolbar's primary look changes, update this string with it.
 */
const PRIMARY_LINK_CLASS =
  'inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-[7px] rounded-full border border-transparent bg-neutral-950 px-4 text-[13px] font-semibold whitespace-nowrap text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.14),0_1px_2px_rgba(10,10,10,.28)] transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] hover:bg-neutral-800 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,.18),0_2px_6px_rgba(10,10,10,.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:translate-y-px active:bg-neutral-950 active:shadow-none sm:h-9'

export interface CreateProductLinkProps {
  label: string
  /** Why creating is not allowed (no `products.Create`), or `null` when it is. Without the right
   * the control stays visible but disabled, with this text as a tooltip — the panel-wide rule. */
  hint: string | null
  className?: string
}

/** «Создать продукт» — the one filled action of the screen, black-and-white like the toolbar's Save. */
export function CreateProductLink({ label, hint, className = '' }: CreateProductLinkProps) {
  if (hint !== null) {
    return (
      <Tooltip enabled content={hint} cursor="not-allowed" className={className}>
        <AdminActionButton label={label} icon={<PlusIcon size={17} />} variant="primary" disabled className="w-full" />
      </Tooltip>
    )
  }

  return (
    <Link to="/admin/tours/new" className={`${PRIMARY_LINK_CLASS} ${className}`}>
      <PlusIcon size={17} />
      {label}
    </Link>
  )
}
