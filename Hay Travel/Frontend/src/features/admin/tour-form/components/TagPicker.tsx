import { useState } from 'react'
import { Card, Checkbox } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import type { TourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import type { TagInfoModel } from '@/shared/types/attours'
import type { TourTagFormState } from '@/features/admin/types/form'

const MAX_TAGS = 3

interface TagPickerProps {
  tags: TagInfoModel[]
  selected: TourTagFormState[]
  onToggle: (tagId: number) => void
}

/** A tag's name is content, but the panel shows it in ITS language when the data has one
 * (ADR 021, decision 5); an untranslated tag falls back to its id so the row stays clickable. */
function tagLabel(tag: TagInfoModel, copy: TourFormCopy): string {
  return copy.localizedName(readLocalized(tag.translations)) || copy.tags.fallback(tag.id)
}

/**
 * Tag multi-select on the tour form. Same checkbox-grid idiom as `RegionPicker`, but with a rule
 * `RegionPicker` doesn't need to enforce: at most `MAX_TAGS` tags (mirrored server-side by
 * `TourValidationService` — this is the UX-friendly front door, not the only guard).
 *
 * Blocks rather than silently replacing (David, 2026-08-16: "блокировать сказав что уже есть —
 * меняйте существующий или удаляйте") — a click on a disallowed tag leaves selection untouched
 * and surfaces why, instead of guessing which tag the admin meant to drop.
 */
export function TagPicker({ tags, selected, onToggle }: TagPickerProps) {
  const copy = useCopy(tourFormCopy)
  // The flag is stored, not the sentence: a message frozen at click time would stay in the
  // language the admin used back then after switching the interface language.
  const [isBlocked, setIsBlocked] = useState(false)

  const sorted = [...tags].sort((a, b) => a.sortOrder - b.sortOrder)
  const isSelected = (tagId: number) => selected.some((tg) => tg.tagId === tagId)

  function handleToggle(tag: TagInfoModel) {
    if (isSelected(tag.id)) {
      onToggle(tag.id)
      setIsBlocked(false)
      return
    }

    if (selected.length >= MAX_TAGS) {
      setIsBlocked(true)
      return
    }

    onToggle(tag.id)
    setIsBlocked(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-neutral-700">
        {copy.tags.label}
        <span className="ml-1.5 font-normal text-neutral-400">
          ({selected.length}/{MAX_TAGS})
        </span>
      </span>
      {sorted.length === 0 ? (
        <p className="text-xs text-neutral-500">{copy.tags.empty}</p>
      ) : (
        <Card padding="sm" className="!bg-neutral-50">
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {sorted.map((tag) => {
              const checked = isSelected(tag.id)
              const disabled = !checked && selected.length >= MAX_TAGS
              return (
                <div key={tag.id} className={disabled ? 'opacity-50' : undefined}>
                  <Checkbox
                    label={tagLabel(tag, copy)}
                    checked={checked}
                    onChange={() => handleToggle(tag)}
                  />
                </div>
              )
            })}
          </div>
        </Card>
      )}
      {isBlocked && (
        <p role="alert" className="text-xs text-rose-700">
          {copy.tags.limitReached(MAX_TAGS)}
        </p>
      )}
    </div>
  )
}
