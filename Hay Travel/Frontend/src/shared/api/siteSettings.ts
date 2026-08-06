/**
 * Public site settings — the hero block (5.2) and the footer's social links. Same real-vs-mock
 * split as `shared/api/tours.ts`: only this module knows the wire shape
 * (`api/SiteSettings/GetPublic`).
 */

import { apiFetch } from '@/shared/lib/http'
import { getStoredLocale, LANGUAGE_CODE_BY_LOCALE } from '@/shared/lib/locale'
import { translate } from '@/shared/i18n/translate'

/** `SiteSettingGroup` values on the backend (`ATTours.Common.Enums.SiteSettingGroup`). */
const SITE_SETTING_GROUP_HERO = 1
const SITE_SETTING_GROUP_CONTACTS = 2
const SITE_SETTING_GROUP_SOCIAL = 3
const SITE_SETTING_GROUP_BRANDING = 4
const SITE_SETTING_GROUP_SEO = 5
const SITE_SETTING_GROUP_CONTENT = 6

export interface HeroContent {
  imageUrl: string
  title: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
}

interface SiteSettingsPublicModel {
  languageCode: number
  values: Record<string, string>
}

/** Used whenever a key is blank (admin has not filled it in yet) or the settings fetch itself
 * fails. A broken/empty settings read must never blank out the first thing a visitor sees. */
function fallbackHero(): HeroContent {
  const locale = getStoredLocale()
  return {
    imageUrl: '/placeholders/tatev.svg',
    title: translate(locale, 'hero.fallback.title'),
    subtitle: translate(locale, 'hero.fallback.subtitle'),
    ctaLabel: translate(locale, 'hero.fallback.ctaLabel'),
    ctaHref: '/trips',
  }
}

/**
 * One entry per social key the admin filled in — keys left blank in the catalog are omitted
 * entirely rather than returned empty, so the footer never has to filter them itself.
 */
export type SocialLink = { key: 'instagram' | 'facebook' | 'telegram' | 'whatsapp' | 'youtube'; url: string }

const SOCIAL_KEY_BY_SETTING: Record<string, SocialLink['key']> = {
  'social.instagramUrl': 'instagram',
  'social.facebookUrl': 'facebook',
  'social.telegramUrl': 'telegram',
  'social.whatsappUrl': 'whatsapp',
  'social.youtubeUrl': 'youtube',
}

/** Never throws — a broken settings read just means the footer shows no social icons. */
export async function getSocialLinks(): Promise<SocialLink[]> {
  try {
    const res = await apiFetch<SiteSettingsPublicModel>(
      `api/SiteSettings/GetPublic?languageCode=${LANGUAGE_CODE_BY_LOCALE[getStoredLocale()]}&group=${SITE_SETTING_GROUP_SOCIAL}`,
    )
    return Object.entries(res.values)
      .filter(([, url]) => url.trim() !== '')
      .flatMap(([settingKey, url]) => {
        const key = SOCIAL_KEY_BY_SETTING[settingKey]
        return key ? [{ key, url }] : []
      })
  } catch {
    return []
  }
}

export interface ContactsContent {
  phone: string
  email: string
  address: string
}

/** Never throws — a broken fetch just means the footer's contact rows render blank, same
 * degrade-gracefully contract as `getSocialLinks`. No frontend-hardcoded fallback text: the
 * backend catalog (`SiteSettingCatalog`) always has a real default for these keys, so in normal
 * operation this never actually comes back empty. */
export async function getContacts(): Promise<ContactsContent> {
  try {
    const res = await apiFetch<SiteSettingsPublicModel>(
      `api/SiteSettings/GetPublic?languageCode=${LANGUAGE_CODE_BY_LOCALE[getStoredLocale()]}&group=${SITE_SETTING_GROUP_CONTACTS}`,
    )
    return {
      phone: res.values['contacts.phone'] ?? '',
      email: res.values['contacts.email'] ?? '',
      address: res.values['contacts.address'] ?? '',
    }
  } catch {
    return { phone: '', email: '', address: '' }
  }
}

/** '' means "no custom logo uploaded yet" — callers fall back to the built-in wordmark, which is
 * an empty-state UI decision, not duplicated site copy. Never throws. */
export async function getLogoUrl(): Promise<string> {
  try {
    const res = await apiFetch<SiteSettingsPublicModel>(
      `api/SiteSettings/GetPublic?languageCode=${LANGUAGE_CODE_BY_LOCALE[getStoredLocale()]}&group=${SITE_SETTING_GROUP_BRANDING}`,
    )
    return res.values['branding.logoUrl'] ?? ''
  } catch {
    return ''
  }
}

export interface ContentText {
  footerTagline: string
  catalogTitle: string
  catalogSubtitle: string
  featuredHeading: string
  /**
   * Shown in `BookingCard` instead of a price once the group reaches 7 people — see
   * `docs/currency-pricing-sync.md` §F5.1. Admin-editable (`Настройки → Тексты сайта`) rather than
   * a frontend constant, because it is copy David will want to tune without a redeploy.
   */
  largeGroupInvitation: string
}

/** Footer tagline, catalog (/trips) heading + subtitle, and the home "избранное" section
 * heading — admin-editable since 2026-08-02 (`Настройки → Тексты сайта`), previously hardcoded
 * in `shared/i18n/dictionary.ts`. Never throws; the backend catalog default covers the blank
 * case, so callers use the value directly with no local fallback string. */
export async function getContentText(): Promise<ContentText> {
  try {
    const res = await apiFetch<SiteSettingsPublicModel>(
      `api/SiteSettings/GetPublic?languageCode=${LANGUAGE_CODE_BY_LOCALE[getStoredLocale()]}&group=${SITE_SETTING_GROUP_CONTENT}`,
    )
    return {
      footerTagline: res.values['content.footerTagline'] ?? '',
      catalogTitle: res.values['content.catalogTitle'] ?? '',
      catalogSubtitle: res.values['content.catalogSubtitle'] ?? '',
      featuredHeading: res.values['content.featuredHeading'] ?? '',
      largeGroupInvitation: res.values['content.largeGroupInvitation'] ?? '',
    }
  } catch {
    return {
      footerTagline: '',
      catalogTitle: '',
      catalogSubtitle: '',
      featuredHeading: '',
      largeGroupInvitation: '',
    }
  }
}

/** '' means no custom favicon has been uploaded in Settings → SEO — callers fall back to the
 * static `/favicon.svg` already wired up in `index.html`. Also '' if the backend catalog
 * doesn't have a `seo.faviconUrl` key yet (B9 is a separate backend task); an unknown key is
 * indistinguishable from a blank one here, which is exactly the fallback behaviour we want.
 * Never throws — see `useFavicon` (shared/hooks), the only caller. */
export async function getFaviconUrl(): Promise<string> {
  try {
    const res = await apiFetch<SiteSettingsPublicModel>(
      `api/SiteSettings/GetPublic?languageCode=${LANGUAGE_CODE_BY_LOCALE[getStoredLocale()]}&group=${SITE_SETTING_GROUP_SEO}`,
    )
    return res.values['seo.faviconUrl'] ?? ''
  } catch {
    return ''
  }
}

export async function getHeroContent(): Promise<HeroContent> {
  const fallback = fallbackHero()
  try {
    const res = await apiFetch<SiteSettingsPublicModel>(
      `api/SiteSettings/GetPublic?languageCode=${LANGUAGE_CODE_BY_LOCALE[getStoredLocale()]}&group=${SITE_SETTING_GROUP_HERO}`,
    )
    const value = res.values
    return {
      imageUrl: value['hero.imageUrl'] || fallback.imageUrl,
      title: value['hero.title'] || fallback.title,
      subtitle: value['hero.subtitle'] || fallback.subtitle,
      ctaLabel: value['hero.ctaLabel'] || fallback.ctaLabel,
      ctaHref: value['hero.ctaHref'] || fallback.ctaHref,
    }
  } catch {
    return fallback
  }
}
