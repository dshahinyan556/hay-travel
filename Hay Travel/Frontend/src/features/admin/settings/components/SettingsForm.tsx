import { useState } from 'react'
import { Tabs, type TabItem } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { sectionCopyFor, settingsCopy } from '@/features/admin/settings/lib/settingsCopy'
import type { SettingFieldState, SettingsFormState } from '@/features/admin/settings/types'
import type { SettingsValidation } from '@/features/admin/settings/lib/validation'
import type { SettingsFormActions } from '@/features/admin/settings/hooks/useSettingsForm'
import { SettingsSectionCard } from './SettingsSectionCard'

interface SettingsFormProps {
  state: SettingsFormState
  actions: SettingsFormActions
  validation: SettingsValidation
  onSubmit: () => void
}

/**
 * Presentational orchestrator: one tab per section (same `Tabs` primitive as the catalog page).
 *
 * Tabs hide the other sections' fields behind a single "Сохранить" button — the risk being the
 * admin forgets what they changed on a tab they've since left. `SettingsActions` covers that: its
 * "Изменено N полей" counter lives in the pinned bottom bar, OUTSIDE this form (it is now
 * `SetupFormLayout`'s `footer`, rendered by `SettingsPage`), so it stays visible no matter which
 * tab is active — the admin never loses sight of pending changes, and "Сохранить" always saves
 * every section, not just the open one. The `<form>` is kept even though its submit button now
 * sits outside it: that is what still makes Enter-in-a-field save.
 *
 * Owns only which tab is active; the field values themselves still live in `useSettingsForm`.
 */
export function SettingsForm({ state, actions, validation, onSubmit }: SettingsFormProps) {
  const copy = useCopy(settingsCopy)
  const tabs: TabItem[] = state.sections.map((section) => ({
    id: String(section.group),
    label: sectionCopyFor(copy, section.group).title,
  }))
  const [activeGroup, setActiveGroup] = useState(state.sections[0]?.group)
  const activeSection = state.sections.find((s) => s.group === activeGroup) ?? state.sections[0]

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      {/* Pinned below the mobile hamburger bar (60px) on phones, flush to the viewport top on
          desktop where that bar doesn't exist. Bleeds to `main`'s own edges (`-mx-4 sm:-mx-6`)
          so the background covers content scrolling underneath it. */}
      <div className="sticky top-[60px] z-10 -mx-4 bg-neutral-50 px-4 pt-1 sm:-mx-6 sm:px-6 md:top-0">
        <Tabs
          tabs={tabs}
          activeId={String(activeSection?.group ?? '')}
          onChange={(id) => setActiveGroup(Number(id))}
          label={copy.tabsLabel}
        />
      </div>

      {activeSection &&
        (() => {
          const section = sectionCopyFor(copy, activeSection.group)
          // `keys` is the source of order; a key can only be missing if the mapper and the
          // section list disagreed, which cannot happen — both are built in one pass.
          const fields = activeSection.keys
            .map((key) => state.fields[key])
            .filter((field): field is SettingFieldState => Boolean(field))

          return (
            <SettingsSectionCard
              key={activeSection.group}
              title={section.title}
              description={section.description}
              fields={fields}
              validation={validation}
              actions={actions}
            />
          )
        })()}
    </form>
  )
}
