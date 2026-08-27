import type { LangKey } from '@/features/admin/types/localized'

/**
 * Полоска-флаг у подписи языковой колонки билингвальной пары.
 *
 * Отдельный модуль, а не константа внутри `TranslationGroup`, потому что потребителей два:
 * сам `TranslationGroup` (пара `Input`/`Textarea`) и редактор письма в разделе уведомлений,
 * который строит такую же пару вокруг двух `RichTextEditor` — билингвального RTE-варианта у
 * `TranslationGroup` нет. Держать константу в файле с компонентом значило бы либо сломать
 * fast-refresh этому файлу, либо продублировать классы и дать им разъехаться.
 *
 * Сами НАЗВАНИЯ языков сюда не входят: имя языка — текст интерфейса и следует языку панели
 * (`adminUiCopy.translation.langName`), а флаг с ним не меняется.
 */
export const LANG_FLAG_CLASS: Record<LangKey, string> = {
  ru: 'bg-gradient-to-b from-white from-33% via-blue-700 via-33% to-red-600 to-66%',
  en: 'bg-blue-900',
}
