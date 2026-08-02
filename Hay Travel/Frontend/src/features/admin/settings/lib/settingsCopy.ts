/**
 * Russian captions for the settings screen. Text only — no logic, no key list.
 *
 * This file is NOT the catalog: the set of settings comes from the server and from nowhere
 * else (ADR 002 lets the backend add a key without a front-end deploy). A key that is missing
 * here still renders — with its raw key as the caption — instead of silently disappearing.
 */

import { SiteSettingGroup } from '@/features/admin/lib/enums'

interface SectionCopy {
  title: string
  description?: string
}

interface FieldCopy {
  label: string
  hint?: string
}

export const sectionCopy: Record<number, SectionCopy> = {
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
    description: 'Подвал, шапка каталога «Путешествия» и заголовок секции «избранное» на главной.',
  },
}

export const fieldCopy: Record<string, FieldCopy> = {
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
}

/** Caption of a field. An unknown key falls back to the key itself — visible, not hidden. */
export function labelFor(key: string): string {
  return fieldCopy[key]?.label ?? key
}

/** Helper text of a field, if it has one. */
export function hintFor(key: string): string | undefined {
  return fieldCopy[key]?.hint
}

/** Caption of a section. A group the front does not know yet renders as «Прочее». */
export function sectionCopyFor(group: number): SectionCopy {
  return sectionCopy[group] ?? { title: 'Прочее' }
}
