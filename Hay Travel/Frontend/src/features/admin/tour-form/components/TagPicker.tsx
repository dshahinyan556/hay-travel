import { useState } from 'react'
import { Card, Checkbox } from '@/shared/ui'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import { TagType, tagTypeLabels } from '@/features/admin/lib/enums'
import type { TagInfoModel } from '@/shared/types/attours'
import type { TourTagFormState } from '@/features/admin/types/form'

const MAX_TAGS = 3

interface TagPickerProps {
  tags: TagInfoModel[]
  selected: TourTagFormState[]
  onToggle: (tagId: number) => void
}

// `discountPercent` is a server-side price-calculation input, never composed into the shown
// text — the name is whatever the admin typed, verbatim (see `shared/api/tours.ts`'s `mapTags`).
function tagLabel(tag: TagInfoModel): string {
  return readLocalized(tag.translations).ru || `тег №${tag.id}`
}

/**
 * Tag multi-select on the tour form. Same checkbox-grid idiom as `RegionPicker`, but with a rule
 * `RegionPicker` doesn't need to enforce: at most `MAX_TAGS` tags, and at most one of
 * `TagType.Discount` (mirrored server-side by `TourValidationService` — this is the UX-friendly
 * front door, not the only guard).
 *
 * Blocks rather than silently replacing (David, 2026-08-16: "блокировать сказав что уже есть —
 * меняйте существующий или удаляйте") — a click on a disallowed tag leaves selection untouched
 * and surfaces why, instead of guessing which tag the admin meant to drop.
 */
export function TagPicker({ tags, selected, onToggle }: TagPickerProps) {
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const sorted = [...tags].sort((a, b) => a.sortOrder - b.sortOrder)
  const byId = new Map(tags.map((tag) => [tag.id, tag]))

  const isSelected = (tagId: number) => selected.some((tg) => tg.tagId === tagId)
  const selectedDiscount = selected
    .map((tg) => byId.get(tg.tagId))
    .find((tag) => tag?.type === TagType.Discount)

  function handleToggle(tag: TagInfoModel) {
    if (isSelected(tag.id)) {
      onToggle(tag.id)
      setBlockedMessage(null)
      return
    }

    if (selected.length >= MAX_TAGS) {
      setBlockedMessage(`На товаре уже ${MAX_TAGS} тега — сначала уберите один, чтобы добавить новый.`)
      return
    }

    if (tag.type === TagType.Discount && selectedDiscount) {
      setBlockedMessage(
        `Скидочный тег уже назначен («${tagLabel(selectedDiscount)}») — сначала измените его или уберите, потом добавляйте другой.`,
      )
      return
    }

    onToggle(tag.id)
    setBlockedMessage(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-neutral-700">
        Теги
        <span className="ml-1.5 font-normal text-neutral-400">
          ({selected.length}/{MAX_TAGS})
        </span>
      </span>
      {sorted.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Тегов пока нет — добавьте их в «Справочники → Теги».
        </p>
      ) : (
        <Card padding="sm" className="!bg-neutral-50">
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {sorted.map((tag) => {
              const checked = isSelected(tag.id)
              const disabled =
                !checked && (selected.length >= MAX_TAGS || (tag.type === TagType.Discount && Boolean(selectedDiscount)))
              return (
                <div key={tag.id} className={disabled ? 'opacity-50' : undefined}>
                  <Checkbox
                    label={`${tagLabel(tag)} (${tagTypeLabels[tag.type as 1 | 2]})`}
                    checked={checked}
                    onChange={() => handleToggle(tag)}
                  />
                </div>
              )
            })}
          </div>
        </Card>
      )}
      {blockedMessage && (
        <p role="alert" className="text-xs text-rose-700">
          {blockedMessage}
        </p>
      )}
    </div>
  )
}
