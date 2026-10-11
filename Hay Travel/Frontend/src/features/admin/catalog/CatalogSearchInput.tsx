import { SearchIcon } from '@/shared/ui/icons'

interface CatalogSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

/** Search box of the catalog control zone — filters the active tab (see `lib/filterDraftRows`). */
export function CatalogSearchInput({ value, onChange, placeholder }: CatalogSearchInputProps) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/15"
      />
    </div>
  )
}
