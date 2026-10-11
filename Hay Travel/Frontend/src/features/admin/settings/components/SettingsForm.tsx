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
 * "N несохранённых изменений" counter sits next to the toolbar in the pinned control zone
 * (`SetupFormLayout.controlZone`, rendered by `SettingsPage`), OUTSIDE this form, so it stays
 * visible no matter which tab is active — and "Сохранить" always saves every section, not just
 * the open one. The `<form>` is kept even though its submit button sits outside it: that is what
 * still makes Enter-in-a-field save.
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
      {/* Not pinned any more (2026-10-11): the toolbar zone above (`SetupFormLayout.controlZone`)
          now takes that exact sticky spot, and two bars pinned at the same `top` would overlap.
          The "N несохранённых изменений" counter rides in the pinned zone instead. */}
      <Tabs
        tabs={tabs}
        activeId={String(activeSection?.group ?? '')}
        onChange={(id) => setActiveGroup(Number(id))}
        label={copy.tabsLabel}
      />

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
