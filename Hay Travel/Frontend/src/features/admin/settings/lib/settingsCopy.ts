/**
 * Captions of the settings screen. Text only — no logic, no key list.
 *
 * This file is NOT the catalog: the set of settings comes from the server and from nowhere
 * else (ADR 002 lets the backend add a key without a front-end deploy). A key that is missing
 * here still renders — with its raw key as the caption — instead of silently disappearing.
 *
 * What is translated here is the CAPTION of a setting, never its value: the value is site content
 * the admin types, and it is already stored per language (RU + EN) by the backend.
 */

import { defineCopy } from '@/shared/i18n/defineCopy'
import { pluralizeEn, pluralizeRu } from '@/shared/lib/format'
import type { Locale } from '@/shared/lib/locale'
import { SiteSettingGroup } from '@/features/admin/lib/enums'

export interface SectionCopy {
  title: string
  description?: string
}

export interface FieldCopy {
  label: string
  hint?: string
}

const ru = {
  title: 'Настройки',
  subtitle: 'Содержимое главного экрана, контакты, соцсети, логотип и SEO публичного сайта.',
  /** Shown when the role may read the settings but not save them (`settings.Update`). */
  readOnlyHint: 'У вашей роли нет права изменять настройки — доступен только просмотр.',

  emptyTitle: 'Настроек пока нет',
  emptyText:
    'Сервер не вернул ни одной настройки. Обновите страницу — если ничего не изменилось, ' +
    'обратитесь к разработчику.',

  tabsLabel: 'Разделы настроек',
  /** Group the front does not know yet — it still gets a tab, just an unnamed one. */
  otherSection: 'Прочее',

  save: 'Сохранить',
  saving: 'Сохранение…',
  invalidForm: 'Проверьте форму: заполните оба языка у обязательных полей (отмечены *).',
  savedAt: (time: string) => `Сохранено в ${time}.`,
  changedFields: (count: number) =>
    `Изменено ${count} ${pluralizeRu(count, ['поле', 'поля', 'полей'])}.`,

  /** Opens the link the admin just typed in a new tab, without retyping it into the address bar. */
  openLink: 'Открыть ↗',
  /** A stored value that has dropped out of the server's option catalog. */
  unknownOption: (value: string) => `${value} — неизвестное значение`,

  required: 'Обязательное поле',
  suspiciousUrl: 'Похоже на неполную ссылку — обычно адрес начинается с https:// или со «/».',

  keyUnknownError:
    'Одна из настроек больше не поддерживается сервером — обновите страницу и попробуйте ещё раз.',
  saveServerError: (status: number) =>
    `Не удалось сохранить: сервер вернул ошибку (${status}). Введённые значения сохранены — попробуйте ещё раз.`,
  saveNetworkError:
    'Не удалось сохранить: проверьте соединение и попробуйте ещё раз. Введённые значения сохранены.',

  sections: {
    [SiteSettingGroup.Hero]: {
      title: 'Главный экран',
      description: 'Первый блок главной страницы: картинка, заголовок и кнопка.',
    },
    [SiteSettingGroup.Branding]: {
      title: 'Брендинг',
      description: 'Логотип агентства — показывается в шапке сайта.',
    },
    [SiteSettingGroup.Contacts]: {
      title: 'Контакты',
      description: 'Как с вами связаться. Показывается в подвале и на странице контактов.',
    },
    [SiteSettingGroup.Social]: {
      title: 'Соцсети',
      description: 'Ссылки на профили. Пустое поле — иконка на сайте не показывается.',
    },
    [SiteSettingGroup.Seo]: {
      title: 'SEO',
      description: 'Как сайт выглядит в поиске и при отправке ссылки в мессенджер.',
    },
    [SiteSettingGroup.Content]: {
      title: 'Тексты сайта',
      description:
        'Подвал, шапка каталога «Путешествия» и заголовок секции «избранное» на главной.',
    },
    [SiteSettingGroup.Theme]: {
      title: 'Тема оформления',
      description:
        'Цветовая палитра сайта и тема, с которой сайт открывается у нового посетителя. ' +
        'Кнопка «светлая/тёмная» в шапке остаётся — посетитель может переключить сам.',
    },
  },

  fields: {
    /* ---- Hero ---- */
    'hero.imageUrl': {
      label: 'Фоновая картинка — URL',
      hint: 'Широкое изображение первого экрана. Вставьте ссылку — превью обновится справа.',
    },
    'hero.title': { label: 'Заголовок' },
    'hero.subtitle': { label: 'Подзаголовок' },
    'hero.ctaLabel': { label: 'Текст кнопки', hint: 'Например: «Смотреть туры».' },
    'hero.ctaHref': {
      label: 'Ссылка кнопки',
      hint: 'Куда ведёт кнопка. Внутренний адрес начинается со «/» — например /trips.',
    },

    /* ---- Branding ---- */
    'branding.logoUrl': {
      label: 'Логотип — URL',
      hint: 'Лучше всего подходит PNG или SVG с прозрачным фоном.',
    },
    'branding.authImageUrl': {
      label: 'Фото на экране входа — URL',
      hint: 'Вертикальный или квадратный кадр Армении. Показывается слева на странице входа. Пусто — покажем стандартную картинку.',
    },

    /* ---- Contacts ---- */
    'contacts.phone': { label: 'Телефон', hint: 'В том виде, в каком его увидит посетитель.' },
    'contacts.email': { label: 'Email' },
    'contacts.address': { label: 'Адрес' },
    'contacts.workingHours': { label: 'Часы работы', hint: 'Например: «Пн–Пт, 10:00–19:00».' },

    /* ---- Social ---- */
    'social.instagramUrl': { label: 'Instagram' },
    'social.facebookUrl': { label: 'Facebook' },
    'social.telegramUrl': { label: 'Telegram' },
    'social.whatsappUrl': { label: 'WhatsApp' },
    'social.youtubeUrl': { label: 'YouTube' },

    /* ---- SEO ---- */
    'seo.siteTitle': {
      label: 'Заголовок сайта (title)',
      hint: 'Строка в результатах поиска и во вкладке браузера.',
    },
    'seo.metaDescription': {
      label: 'Описание (meta description)',
      hint: 'Одно-два предложения, примерно до 160 символов — их показывает поиск под заголовком.',
    },
    'seo.ogImageUrl': {
      label: 'Картинка для соцсетей (og:image)',
      hint: 'Превью, которое подтягивается при отправке ссылки в мессенджер.',
    },

    /* ---- Content ---- */
    'content.footerTagline': {
      label: 'Подпись в подвале',
      hint: 'Короткое описание под логотипом «Hay Travel» в футере.',
    },
    'content.catalogTitle': {
      label: 'Заголовок каталога',
      hint: 'Крупный заголовок вверху страницы «Путешествия» (/trips).',
    },
    'content.catalogSubtitle': {
      label: 'Подзаголовок каталога',
      hint: 'Пояснение под заголовком «Путешествия».',
    },
    'content.featuredHeading': {
      label: 'Заголовок секции «Избранное»',
      hint: 'Заголовок блока с подборкой туров на главной странице.',
    },
    'content.largeGroupInvitation': {
      label: 'Приглашение для больших групп',
      hint: 'Текст вместо цены в карточке бронирования, когда гостей 7 и больше.',
    },

    /* ---- Theme ---- */
    'theme.activePalette': {
      label: 'Палитра сайта',
      hint: 'Меняет все цвета публичного сайта разом. Админка остаётся в своём оформлении.',
    },
    'theme.defaultMode': {
      label: 'Тема по умолчанию',
      hint: 'С какой темы открывается сайт у того, кто ещё ни разу не нажимал переключатель. Чужой выбор не сбрасывается.',
    },
    'theme.navStyle': {
      label: 'Стиль навигации',
      hint: 'Оформление шапки и нижнего меню на публичном сайте.',
    },
  },
}

/**
 * Neither `sections` nor `fields` is widened to a `Record<…>` on the `ru` side on purpose: the
 * inferred literal key sets are what make the mapped type below reject an English half that has
 * lost a key or gained one. The `Record` view is applied where it is actually needed — in the
 * lookup helpers, which take a runtime key the server chose.
 */
const en: { [K in keyof typeof ru]: (typeof ru)[K] } = {
  title: 'Settings',
  subtitle: 'Home-screen content, contacts, social links, logo and SEO of the public site.',
  readOnlyHint: 'Your role cannot change the settings — view only.',

  emptyTitle: 'No settings yet',
  emptyText:
    'The server returned no settings at all. Refresh the page — if nothing changes, contact ' +
    'your developer.',

  tabsLabel: 'Settings sections',
  otherSection: 'Other',

  save: 'Save',
  saving: 'Saving…',
  invalidForm: 'Check the form: fill in both languages for the required fields (marked *).',
  savedAt: (time: string) => `Saved at ${time}.`,
  changedFields: (count: number) =>
    `${count} ${pluralizeEn(count, ['field', 'fields'])} changed.`,

  openLink: 'Open ↗',
  unknownOption: (value: string) => `${value} — unknown value`,

  required: 'This field is required',
  suspiciousUrl:
    'This looks like an incomplete link — an address usually starts with https:// or with “/”.',

  keyUnknownError:
    'One of the settings is no longer supported by the server — refresh the page and try again.',
  saveServerError: (status: number) =>
    `Could not save: the server returned an error (${status}). Your input is kept — please try again.`,
  saveNetworkError: 'Could not save: check your connection and try again. Your input is kept.',

  sections: {
    [SiteSettingGroup.Hero]: {
      title: 'Hero section',
      description: 'The first block of the home page: image, heading and button.',
    },
    [SiteSettingGroup.Branding]: {
      title: 'Branding',
      description: 'The agency logo — shown in the site header.',
    },
    [SiteSettingGroup.Contacts]: {
      title: 'Contacts',
      description: 'How to reach you. Shown in the footer and on the contacts page.',
    },
    [SiteSettingGroup.Social]: {
      title: 'Social links',
      description: 'Links to your profiles. An empty field hides that icon on the site.',
    },
    [SiteSettingGroup.Seo]: {
      title: 'SEO',
      description: 'How the site looks in search results and when a link is shared in a messenger.',
    },
    [SiteSettingGroup.Content]: {
      title: 'Site texts',
      description:
        'The footer, the “Trips” catalog header and the “featured” section heading on the home page.',
    },
    [SiteSettingGroup.Theme]: {
      title: 'Appearance',
      description:
        'The colour palette of the site and the theme a first-time visitor sees. ' +
        'The light/dark button in the header stays — a visitor can still switch it themselves.',
    },
  },

  fields: {
    /* ---- Hero ---- */
    'hero.imageUrl': {
      label: 'Background image — URL',
      hint: 'A wide image for the first screen. Paste a link — the preview on the right updates.',
    },
    'hero.title': { label: 'Heading' },
    'hero.subtitle': { label: 'Subheading' },
    'hero.ctaLabel': { label: 'Button text', hint: 'For example: “Browse tours”.' },
    'hero.ctaHref': {
      label: 'Button link',
      hint: 'Where the button leads. An internal address starts with “/” — /trips, for example.',
    },

    /* ---- Branding ---- */
    'branding.logoUrl': {
      label: 'Logo — URL',
      hint: 'A PNG or an SVG with a transparent background works best.',
    },
    'branding.authImageUrl': {
      label: 'Sign-in screen photo — URL',
      hint: 'A portrait or square shot of Armenia. Shown on the left of the sign-in page. Leave it empty and we show the default image.',
    },

    /* ---- Contacts ---- */
    'contacts.phone': { label: 'Phone', hint: 'Exactly as the visitor will see it.' },
    'contacts.email': { label: 'Email' },
    'contacts.address': { label: 'Address' },
    'contacts.workingHours': { label: 'Working hours', hint: 'For example: “Mon–Fri, 10:00–19:00”.' },

    /* ---- Social ---- */
    'social.instagramUrl': { label: 'Instagram' },
    'social.facebookUrl': { label: 'Facebook' },
    'social.telegramUrl': { label: 'Telegram' },
    'social.whatsappUrl': { label: 'WhatsApp' },
    'social.youtubeUrl': { label: 'YouTube' },

    /* ---- SEO ---- */
    'seo.siteTitle': {
      label: 'Site title (title)',
      hint: 'The line shown in search results and in the browser tab.',
    },
    'seo.metaDescription': {
      label: 'Description (meta description)',
      hint: 'One or two sentences, up to roughly 160 characters — search engines show them under the title.',
    },
    'seo.ogImageUrl': {
      label: 'Social preview image (og:image)',
      hint: 'The preview pulled in when a link is shared in a messenger.',
    },

    /* ---- Content ---- */
    'content.footerTagline': {
      label: 'Footer tagline',
      hint: 'A short line under the “Hay Travel” logo in the footer.',
    },
    'content.catalogTitle': {
      label: 'Catalog heading',
      hint: 'The large heading at the top of the “Trips” page (/trips).',
    },
    'content.catalogSubtitle': {
      label: 'Catalog subheading',
      hint: 'The line under the “Trips” heading.',
    },
    'content.featuredHeading': {
      label: '“Featured” section heading',
      hint: 'The heading of the curated tours block on the home page.',
    },
    'content.largeGroupInvitation': {
      label: 'Large-group invitation',
      hint: 'Shown instead of the price in the booking card when there are 7 guests or more.',
    },

    /* ---- Theme ---- */
    'theme.activePalette': {
      label: 'Site palette',
      hint: 'Changes every colour of the public site at once. The admin panel keeps its own look.',
    },
    'theme.defaultMode': {
      label: 'Default theme',
      hint: 'Which theme the site opens with for someone who has never touched the toggle. It never resets anybody else’s choice.',
    },
    'theme.navStyle': {
      label: 'Navigation style',
      hint: 'The look of the header and of the bottom menu on the public site.',
    },
  },
}

export const settingsCopy = defineCopy(ru, en)
export type SettingsCopy = ReturnType<typeof settingsCopy>

/** Caption of a field. An unknown key falls back to the key itself — visible, not hidden. */
export function labelFor(copy: SettingsCopy, key: string): string {
  return (copy.fields as Record<string, FieldCopy | undefined>)[key]?.label ?? key
}

/** Helper text of a field, if it has one. */
export function hintFor(copy: SettingsCopy, key: string): string | undefined {
  return (copy.fields as Record<string, FieldCopy | undefined>)[key]?.hint
}

/** Caption of a section. A group the front does not know yet renders as «Прочее»/"Other". */
export function sectionCopyFor(copy: SettingsCopy, group: number): SectionCopy {
  return (
    (copy.sections as Record<number, SectionCopy | undefined>)[group] ?? { title: copy.otherSection }
  )
}

/**
 * Time of the last successful save. `en-GB` rather than `en-US` (spec 009 §5): a 24-hour clock is
 * what the rest of the panel — and the team reading it — already uses.
 */
const TIME_FORMAT: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  en: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }),
}

export function formatSavedAt(locale: Locale, date: Date): string {
  return TIME_FORMAT[locale].format(date)
}
