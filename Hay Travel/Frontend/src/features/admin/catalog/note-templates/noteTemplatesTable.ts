import {
  createTourNoteTemplate,
  deleteTourNoteTemplate,
  updateTourNoteTemplate,
} from '@/features/admin/api/adminCatalog'
import { TourNoteType } from '@/features/admin/lib/enums'
import type { TourNoteTemplateInfoModel } from '@/shared/types/attours'
import { nameForCreate, nameForUpdate, nameValuesOf, validateName, type NameValues } from '../lib/catalogNameFields'
import type { CatalogTableDef } from '../lib/useCatalogTableDraft'

/** `type` is the `TourNoteType` as a string — the shape `Select` works with. */
export interface NoteTemplateValues extends NameValues {
  type: string
}

export type NoteTypeFilter = 'all' | TourNoteType

export const NOTE_TYPES: TourNoteType[] = [
  TourNoteType.OrganizationalDetail,
  TourNoteType.Restriction,
  TourNoteType.Included,
  TourNoteType.NotIncluded,
]

/**
 * All note types share ONE flat list and ONE `sortOrder` sequence — deliberate: the backend has
 * only a plain index on `Type` and no `(Type, SortOrder)` constraint, and the tour form, which
 * filters templates by type, still sees each type's rows in the order shown here.
 */
export const noteTemplatesTable: CatalogTableDef<TourNoteTemplateInfoModel, NoteTemplateValues> = {
  toValues: (item) => ({ ...nameValuesOf(item.translations), type: String(item.type) }),
  emptyValues: () => ({ nameRu: '', nameEn: '', type: String(TourNoteType.OrganizationalDetail) }),
  validate: validateName,
  update: (item, values, sortOrder) =>
    updateTourNoteTemplate({
      id: item.id,
      type: Number(values.type),
      sortOrder,
      translations: nameForUpdate(values),
    }),
  create: (values, sortOrder) =>
    createTourNoteTemplate({ type: Number(values.type), sortOrder, translations: nameForCreate(values) }),
  remove: deleteTourNoteTemplate,
  errorActions: (copy) => copy.noteTemplates.actions,
}
