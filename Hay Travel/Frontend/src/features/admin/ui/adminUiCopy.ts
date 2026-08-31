import { defineCopy } from '@/shared/i18n/defineCopy'
import type { LangKey } from '@/features/admin/types/localized'

/**
 * Copy of the cross-feature admin components in this folder — the image repeater/upload controls,
 * the side panel, the bilingual field matrix, the job-role picker.
 *
 * They are shared by several features, so their text cannot live in any one feature's copy module;
 * it also is not `shared/ui` text, because these components are admin-specific by definition.
 * Enum captions are NOT duplicated here — they come from `features/admin/lib/adminEnumsCopy.ts`.
 */
export const adminUiCopy = defineCopy(
  {
    images: {
      /** `itemLabel` of the image repeater's `SortableList` — used in drag announcements. */
      item: 'Картинка',
      dragImage: (index: number) => `Перетащить картинку ${index}, чтобы изменить порядок`,
      urlLabel: (index: number) => `Ссылка на картинку ${index}`,
      uploadInstead: (index: number) => `Загрузить файл вместо картинки ${index}`,
      remove: 'Удалить картинку',
      add: 'Добавить картинку',
      upload: 'Загрузить файл',
      uploading: 'Загрузка…',
      urlHint: 'Вставьте ссылку на изображение — превью обновится справа.',
      previewAlt: (label: string) => `Превью: ${label}`,
      previewEmpty: 'превью по URL',
      errorFileType: 'Только JPEG, PNG или WebP.',
      errorFileSize: 'Файл больше 8 МБ.',
      errorUploadFailed: 'Не удалось загрузить файл.',
    },
    sidePanel: {
      close: 'Закрыть',
    },
    translation: {
      /** Tab captions of the RU/EN matrix — the language NAMES, not the content. */
      langName: { ru: 'Русский', en: 'Английский' } as Record<LangKey, string>,
      /** Accessible name of one cell: "Название — Русский". */
      fieldInLang: (field: string, lang: string) => `${field} — ${lang}`,
    },
    employeeJobRole: {
      placeholder: 'Роль…',
      unset: 'Не задано',
    },
    tourTable: {
      untitled: '— без названия —',
    },
    /** `RichTextEditor`'s own toolbar/dialogs (spec 011) — lives here rather than in one
     * feature's copy module because the editor itself must not know about email or tours
     * (ADR 023: it is a cross-feature primitive, same reasoning as `images` above). */
    richText: {
      boldGlyph: 'Ж',
      boldTitle: 'Жирный',
      italicGlyph: 'К',
      italicTitle: 'Курсив',
      underlineGlyph: 'Ч',
      underlineTitle: 'Подчёркнутый',
      strikeGlyph: 'S',
      strikeTitle: 'Зачёркнутый',

      headingLabel: 'Стиль текста',
      headingNormal: 'Обычный текст',
      headingLevel: (level: number) => `Заголовок ${level}`,

      bulletListTitle: 'Маркированный список',
      orderedListTitle: 'Нумерованный список',
      blockquoteTitle: 'Цитата',

      alignLeftTitle: 'По левому краю',
      alignCenterTitle: 'По центру',
      alignRightTitle: 'По правому краю',

      codeTitle: 'Преформатированный текст',

      fontSizeLabel: 'Размер текста',
      fontSizeNormal: 'Обычный',

      fontFamilyLabel: 'Шрифт',
      fontFamilyNormal: 'По умолчанию',

      colorTitle: 'Цвет текста',
      colorFillTitle: 'Заливка текста',
      colorDefault: 'По умолчанию',
      colorHexInvalid: 'Введите цвет в формате #rrggbb.',

      tableTitle: 'Вставить таблицу',

      linkTitle: 'Вставить ссылку',
      linkRemove: 'Удалить ссылку',
      linkUrlLabel: 'Ссылка',
      linkUrlPlaceholder: 'https://…',
      linkApply: 'Применить',
      linkInvalid: 'Ссылка должна начинаться с http://, https:// или mailto:.',

      imageTitle: 'Вставить картинку',
      imageTabUpload: 'Загрузить файл',
      imageTabUrl: 'Ссылка на картинку',
      imageUrlPlaceholder: 'https://… или /uploads/…',
      imageUrlInvalid: 'Ссылка должна начинаться с http://, https:// или вести на /uploads/…',
      imageAltLabel: 'Описание (alt)',
      imageAltHint:
        'Покажется, если картинка не загрузится — важно для писем: многие почтовые клиенты по умолчанию не показывают картинки.',
      imageInsert: 'Вставить',

      undoTitle: 'Отменить',
      redoTitle: 'Повторить',

      placeholderButton: 'Вставить поле',
      placeholderMenuLabel: 'Доступные поля',
      unknownPlaceholderHint: 'Поле из бэкенда без описания на фронте — вставится как есть.',
    },
  },
  {
    images: {
      item: 'Image',
      dragImage: (index: number) => `Drag image ${index} to reorder`,
      urlLabel: (index: number) => `Image ${index} URL`,
      uploadInstead: (index: number) => `Upload a file instead of image ${index}`,
      remove: 'Remove image',
      add: 'Add image',
      upload: 'Upload a file',
      uploading: 'Uploading…',
      urlHint: 'Paste a link to the image — the preview on the right will update.',
      previewAlt: (label: string) => `Preview: ${label}`,
      previewEmpty: 'preview by URL',
      errorFileType: 'JPEG, PNG or WebP only.',
      errorFileSize: 'The file is larger than 8 MB.',
      errorUploadFailed: 'Could not upload the file.',
    },
    sidePanel: {
      close: 'Close',
    },
    translation: {
      langName: { ru: 'Russian', en: 'English' } as Record<LangKey, string>,
      fieldInLang: (field: string, lang: string) => `${field} — ${lang}`,
    },
    employeeJobRole: {
      placeholder: 'Role…',
      unset: 'Not set',
    },
    tourTable: {
      untitled: '— untitled —',
    },
    richText: {
      boldGlyph: 'B',
      boldTitle: 'Bold',
      italicGlyph: 'I',
      italicTitle: 'Italic',
      underlineGlyph: 'U',
      underlineTitle: 'Underline',
      strikeGlyph: 'S',
      strikeTitle: 'Strikethrough',

      headingLabel: 'Text style',
      headingNormal: 'Normal text',
      headingLevel: (level: number) => `Heading ${level}`,

      bulletListTitle: 'Bulleted list',
      orderedListTitle: 'Numbered list',
      blockquoteTitle: 'Quote',

      alignLeftTitle: 'Align left',
      alignCenterTitle: 'Align center',
      alignRightTitle: 'Align right',

      codeTitle: 'Preformatted text',

      fontSizeLabel: 'Text size',
      fontSizeNormal: 'Normal',

      fontFamilyLabel: 'Font',
      fontFamilyNormal: 'Default',

      colorTitle: 'Text colour',
      colorFillTitle: 'Text highlight',
      colorDefault: 'Default',
      colorHexInvalid: 'Enter a colour as #rrggbb.',

      tableTitle: 'Insert table',

      linkTitle: 'Insert a link',
      linkRemove: 'Remove link',
      linkUrlLabel: 'Link',
      linkUrlPlaceholder: 'https://…',
      linkApply: 'Apply',
      linkInvalid: 'The link must start with http://, https:// or mailto:.',

      imageTitle: 'Insert an image',
      imageTabUpload: 'Upload a file',
      imageTabUrl: 'Image link',
      imageUrlPlaceholder: 'https://… or /uploads/…',
      imageUrlInvalid: 'The link must start with http://, https:// or point to /uploads/…',
      imageAltLabel: 'Description (alt)',
      imageAltHint:
        'Shown if the image fails to load — matters for email, since many mail clients hide images by default.',
      imageInsert: 'Insert',

      undoTitle: 'Undo',
      redoTitle: 'Redo',

      placeholderButton: 'Insert a field',
      placeholderMenuLabel: 'Available fields',
      unknownPlaceholderHint: 'A field from the backend with no frontend caption — inserted as-is.',
    },
  },
)
