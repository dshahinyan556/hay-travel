import { useState } from 'react'
import { Tabs, type TabItem } from '@/shared/ui'
import { sectionCopyFor } from '@/features/admin/settings/lib/settingsCopy'
import type { SettingFieldState, SettingsFormState } from '@/features/admin/settings/types'
import type { SettingsValidation } from '@/features/admin/settings/lib/validation'
import type { SettingsFormActions } from '@/features/admin/settings/hooks/useSettingsForm'
import { SettingsSectionCard } from './SettingsSectionCard'
import { SettingsActions } from './SettingsActions'

interface SettingsFormProps {
  state: SettingsFormState
  actions: SettingsFormActions
  validation: SettingsValidation
  dirtyCount: number
  canSubmit: boolean
  hasAttemptedSubmit: boolean
  isSubmitting: boolean
  error: string | null
  savedAt: Date | null
  onSubmit: () => void
}

/**
 * Presentational orchestrator: one tab per section (same `Tabs` primitive as the catalog page),
 * plus the sticky bottom action bar.
 *
 * Tabs hide the other sections' fields behind a single "Сохранить" button — the risk being the
 * admin forgets what they changed on a tab they've since left. `SettingsActions` covers that: its
 * "Изменено N полей" counter lives in the sticky bottom bar, outside the tab content, so it stays
 * visible no matter which tab is active — the admin never loses sight of pending changes, and
 * "Сохранить" always saves every section, not just the open one.
 *
 * Owns only which tab is active; the field values themselves still live in `useSettingsForm`.
 */
export function SettingsForm({
  state,
  actions,
  validation,
  dirtyCount,
  canSubmit,
  hasAttemptedSubmit,
  isSubmitting,
  error,
  savedAt,
  onSubmit,
}: SettingsFormProps) {
  const tabs: TabItem[] = state.sections.map((section) => ({
    id: String(section.group),
    label: sectionCopyFor(section.group).title,
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
          label="Разделы настроек"
        />
      </div>

      {activeSection &&
        (() => {
          const copy = sectionCopyFor(activeSection.group)
          // `keys` is the source of order; a key can only be missing if the mapper and the
          // section list disagreed, which cannot happen — both are built in one pass.
          const fields = activeSection.keys
            .map((key) => state.fields[key])
            .filter((field): field is SettingFieldState => Boolean(field))

          return (
            <SettingsSectionCard
              key={activeSection.group}
              title={copy.title}
              description={copy.description}
              fields={fields}
              validation={validation}
              actions={actions}
            />
          )
        })()}

      <SettingsActions
        dirtyCount={dirtyCount}
        isValid={validation.isValid}
        hasAttemptedSubmit={hasAttemptedSubmit}
        canSubmit={canSubmit}
        isSubmitting={isSubmitting}
        error={error}
        savedAt={savedAt}
        onSubmit={onSubmit}
      />
    </form>
  )
}
