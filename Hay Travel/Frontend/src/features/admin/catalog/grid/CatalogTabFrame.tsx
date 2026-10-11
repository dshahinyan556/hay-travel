import type { ReactNode } from 'react'
import { Card } from '@/shared/ui'
import type { ScreenPermission } from '@/shared/auth'
import type { CatalogEntity } from '../lib/catalogDraft'
import type { CatalogTableDraft } from '../lib/useCatalogTableDraft'

/** What `CatalogPage` hands every tab — the tab adds only its own extras (regions list, filter…). */
export interface CatalogTabProps<T extends CatalogEntity, V extends object> {
  draft: CatalogTableDraft<T, V>
  permission: ScreenPermission
  /** The toolbar's search text for this tab. */
  query: string
  /** Save in flight. */
  locked: boolean
  /** Validation messages are visible (set by the first Save attempt). */
  showErrors: boolean
}

interface CatalogTabFrameProps {
  /** The catalog has no rows at all (not even new ones). */
  isEmpty: boolean
  emptyText: string
  /** Set when a search/filter left nothing to show. */
  nothingFoundText: string | null
  /** Small state line above the grid, e.g. «Изменение порядка недоступно во время поиска». */
  notice?: string | null
  /** Controls above the grid that belong to this tab only (the notes type filter). */
  toolbar?: ReactNode
  children: ReactNode
}

/** Shared empty / nothing-found / notice states around a tab's grid. */
export function CatalogTabFrame({ isEmpty, emptyText, nothingFoundText, notice, toolbar, children }: CatalogTabFrameProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {toolbar}
      {isEmpty ? (
        <Card className="text-center text-sm text-neutral-500">{emptyText}</Card>
      ) : nothingFoundText ? (
        <Card className="text-center text-sm text-neutral-500">{nothingFoundText}</Card>
      ) : (
        <>
          {notice && <p className="text-xs text-neutral-400">{notice}</p>}
          {children}
        </>
      )}
    </div>
  )
}
