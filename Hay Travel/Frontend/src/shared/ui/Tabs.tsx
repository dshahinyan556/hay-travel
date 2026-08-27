export interface TabItem {
  id: string
  label: string
  /** Small counter/status badge shown after the label, e.g. a day count. */
  badge?: string | number
}

export interface TabsProps {
  tabs: TabItem[]
  activeId: string
  onChange: (id: string) => void
  /** Accessible name for the tab list, e.g. "Разделы формы тура". */
  label: string
}

/**
 * Underline-style tab list (button row + active underline), controlled by the parent — this
 * component holds no state and renders no panels. Pair it with content the parent shows/hides
 * based on `activeId`.
 *
 * When the tabs don't fit (narrow / mobile screens) the row scrolls horizontally, but the OS
 * scrollbar is hidden (`no-scrollbar`) — on Windows it otherwise drew a bar plus arrow buttons
 * that looked like stray controls. A right-edge gradient fades the last tab instead, hinting
 * "there's more, swipe" without any chrome.
 */
export function Tabs({ tabs, activeId, onChange, label }: TabsProps) {
  return (
    <div className="relative border-b border-neutral-200">
      <div role="tablist" aria-label={label} className="no-scrollbar flex gap-1 overflow-x-auto px-1">
        {tabs.map((tab) => {
          const selected = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              // Tabs are a segment control: colour cross-fade only, on `--dur-micro` (2.4 §5).
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] ${
                selected
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    selected ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {/* Scrollability hint — fades the trailing edge. Purely decorative, never blocks clicks. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
      />
    </div>
  )
}
