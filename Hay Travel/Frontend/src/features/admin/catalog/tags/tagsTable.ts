import { createTag, deleteTag, updateTag } from '@/features/admin/api/adminCatalog'
import { TagColor, TagType } from '@/features/admin/lib/enums'
import type { TagInfoModel } from '@/shared/types/attours'
import { nameForCreate, nameForUpdate, nameValuesOf, validateName, type NameValues } from '../lib/catalogNameFields'
import type { CatalogTableDef } from '../lib/useCatalogTableDraft'

export interface TagValues extends NameValues {
  color: TagColor
}

/** Product tags — RU/EN name + colour. No `type` field: `TagType` is single-member (Фаза 3/7,
 * discount moved to the tour itself), every save sends `TagType.Regular`. */
export const tagsTable: CatalogTableDef<TagInfoModel, TagValues> = {
  toValues: (item) => ({ ...nameValuesOf(item.translations), color: item.color as TagColor }),
  emptyValues: () => ({ nameRu: '', nameEn: '', color: TagColor.Gold }),
  validate: validateName,
  update: (item, values, sortOrder) =>
    updateTag({
      id: item.id,
      type: TagType.Regular,
      color: values.color,
      sortOrder,
      translations: nameForUpdate(values),
    }),
  create: (values, sortOrder) =>
    createTag({ type: TagType.Regular, color: values.color, sortOrder, translations: nameForCreate(values) }),
  remove: deleteTag,
  errorActions: (copy) => copy.tags.actions,
}
