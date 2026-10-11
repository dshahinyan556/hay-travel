import {
  createExpenseTemplate,
  deleteExpenseTemplate,
  updateExpenseTemplate,
} from '@/features/admin/api/adminCatalog'
import type { ExpenseTemplateInfoModel } from '@/shared/types/attours'
import { nameForCreate, nameForUpdate, nameValuesOf, validateName, type NameValues } from '../lib/catalogNameFields'
import type { CatalogTableDef } from '../lib/useCatalogTableDraft'

export type ExpenseTemplateValues = NameValues

/** Доп. расходы — just the RU/EN name; position comes from the drag order. */
export const expenseTemplatesTable: CatalogTableDef<ExpenseTemplateInfoModel, ExpenseTemplateValues> = {
  toValues: (item) => nameValuesOf(item.translations),
  emptyValues: () => ({ nameRu: '', nameEn: '' }),
  validate: validateName,
  update: (item, values, sortOrder) =>
    updateExpenseTemplate({ id: item.id, sortOrder, translations: nameForUpdate(values) }),
  create: (values, sortOrder) => createExpenseTemplate({ sortOrder, translations: nameForCreate(values) }),
  remove: deleteExpenseTemplate,
  errorActions: (copy) => copy.expenseTemplates.actions,
}
