import { createVehicleClass, deleteVehicleClass, updateVehicleClass } from '@/features/admin/api/adminCatalog'
import type { VehicleClassInfoModel } from '@/shared/types/attours'
import type { FieldErrors } from '../lib/catalogDraft'
import { nameForCreate, nameForUpdate, nameValuesOf, validateName, type NameValues } from '../lib/catalogNameFields'
import type { CatalogTableDef } from '../lib/useCatalogTableDraft'

/** `capacity`/`luggageCapacity` are held as TEXT while editing: a number state would turn an
 * erased cell into `0` on screen; they are parsed on compare and on save. */
export interface VehicleClassValues extends NameValues {
  capacity: string
  luggageCapacity: string
  isActive: boolean
}

/** Integer value of a typed number, or `null` when it isn't one. */
function parseInteger(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isInteger(n) ? n : null
}

/** «3» and «03» are the same capacity; anything unparsable stays as typed so it still counts. */
const integerProjection = (value: string) => parseInteger(value) ?? value.trim()

/** Pricing tier for predefined transfers (batch 2026-08-29, decision 0.7): passenger capacity,
 * luggage limit in units (medium suitcase = 3, large = 5) and an `isActive` flag that hides the
 * class from selection without deleting it (still referenced by past prices/orders). */
export const vehicleClassesTable: CatalogTableDef<VehicleClassInfoModel, VehicleClassValues> = {
  toValues: (item) => ({
    ...nameValuesOf(item.translations),
    capacity: String(item.capacity),
    luggageCapacity: String(item.luggageCapacity),
    isActive: item.isActive,
  }),
  emptyValues: () => ({ nameRu: '', nameEn: '', capacity: '1', luggageCapacity: '0', isActive: true }),
  normalizers: { capacity: integerProjection, luggageCapacity: integerProjection },
  validate: (values, copy) => {
    // Same rules as the old `VehicleClassForm`: integer ≥ 1 passenger, integer ≥ 0 luggage units.
    const errors: FieldErrors<VehicleClassValues> = { ...validateName(values, copy) }
    const capacity = parseInteger(values.capacity)
    if (capacity === null || capacity < 1) errors.capacity = copy.vehicleClasses.capacityError
    const luggage = parseInteger(values.luggageCapacity)
    if (luggage === null || luggage < 0) errors.luggageCapacity = copy.vehicleClasses.luggageCapacityError
    return errors
  },
  update: (item, values, sortOrder) =>
    updateVehicleClass({
      id: item.id,
      capacity: Number(values.capacity.trim()),
      luggageCapacity: Number(values.luggageCapacity.trim()),
      isActive: values.isActive,
      sortOrder,
      translations: nameForUpdate(values),
    }),
  create: (values, sortOrder) =>
    createVehicleClass({
      capacity: Number(values.capacity.trim()),
      luggageCapacity: Number(values.luggageCapacity.trim()),
      isActive: values.isActive,
      sortOrder,
      translations: nameForCreate(values),
    }),
  remove: deleteVehicleClass,
  errorActions: (copy) => copy.vehicleClasses.actions,
  inUseMessage: (copy) => copy.vehicleClasses.deleteInUseError,
}
