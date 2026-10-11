/**
 * Публичная поверхность контактного домена (спека 016 / ADR 032).
 *
 * Собрана здесь, а не в `features/auth/account`, потому что контактами пользуются ТРИ экрана из
 * трёх разных фич: справочник в личном кабинете, блок контактов в корзине и он же в конструкторе
 * трансфера. Фича не может импортировать другую фичу, а правила «что считается верным номером» и
 * «сколько контактов у заказа» обязаны быть одни — иначе экраны разошлись бы на первой же правке.
 *
 * Кабинет продолжает импортировать по прежним путям: на них оставлены тонкие реэкспорты, чтобы
 * переезд не переписывал шесть разделов, к которым он не имеет отношения.
 */

export { OrderContactsPicker, type OrderContactsPickerProps } from './OrderContactsPicker'
export { ContactCard, type ContactCardProps } from './components/ContactCard'
export { ContactForm, type ContactFormProps } from './components/ContactForm'
export { OrderContactCard, type OrderContactCardProps } from './components/OrderContactCard'

export {
  createContact,
  deleteContact,
  getContactProfile,
  getContacts,
  setPrimaryContact,
  updateContact,
  type ContactMethodInput,
  type ContactProfile,
} from './api/contacts'

export {
  contactFullName,
  contactNameAndValue,
  describeContact,
  type ContactLike,
} from './lib/contactDisplay'

export {
  ContactErrorCode,
  contactErrorMessageKey,
  OrderContactErrorCode,
  orderContactErrorKey,
} from './lib/contactErrors'

export {
  CONTACT_METHOD_LABEL_KEY,
  CONTACT_METHOD_ORDER,
  CONTACT_VALUE_LABEL_KEY,
  contactAutoComplete,
  contactFirstNameErrorKey,
  contactInputMode,
  contactValueErrorKey,
  normalizeContactValue,
  profileValueForType,
} from './lib/contactValidation'

export {
  addOrderContact,
  ensureSinglePrimary,
  isOrderContactsValid,
  isSameContact,
  readLastOrderContacts,
  rememberOrderContacts,
  removeOrderContact,
  setPrimaryOrderContact,
  toOrderContact,
} from './lib/orderContacts'
