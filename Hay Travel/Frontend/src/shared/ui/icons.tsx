/**
 * Hand-drawn line icons for the public site.
 *
 * Emoji were explicitly rejected by the client, and pulling in an icon font for ~12 glyphs
 * would cost a network request and a flash of unstyled icons. These are plain SVG paths that
 * inherit `currentColor` and the surrounding font size, so they tint with the gold/wine text
 * they sit next to.
 *
 * All icons share one geometry contract: a 24×24 box, 1.5 stroke, round caps/joins — that
 * consistency is what makes a hand-rolled set read as a family rather than clip art.
 */

import type { SVGProps } from 'react'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Rendered size in px. Defaults to 1em so icons scale with their label. */
  size?: number | string
}

function Icon({ size = '1em', ...props }: IconProps & { children?: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative by default: labels next to icons carry the meaning. Callers that use an
      // icon on its own (icon-only button) pass `aria-label` and override this.
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  )
}

/** Excursion marker — a single day, no overnight stay. */
export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  )
}

/** Tour marker — 2+ days, at least one night. */
export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </Icon>
  )
}

export function MountainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 20h20L14.5 7l-3.2 5.5L9 9Z" />
      <path d="M12.4 12.2 14.5 7" />
    </Icon>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z" />
    </Icon>
  )
}

export function TagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12.6 12.6 20a2 2 0 0 1-2.8 0l-5.8-5.8a2 2 0 0 1 0-2.8L11.4 4H20Z" />
      <circle cx="16" cy="8" r="1.4" />
    </Icon>
  )
}

/** Guided tour — a person, not a seat. */
export function GuideIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </Icon>
  )
}

/** Identity/name field — same geometry as `GuideIcon` (a head-and-shoulders silhouette), under a
 * distinct name for the auth form's "name"/"username" fields, which are not about guided tours. */
export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </Icon>
  )
}

/** Login/handle field — an "@" glyph, distinct from `UserIcon` so a username field doesn't read
 * as just another name field next to Имя/Фамилия. */
export function AtIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 11.5v1.3a2.7 2.7 0 0 0 5.4 0v-1a9.4 9.4 0 1 0-3.7 7.5" />
    </Icon>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3.2 6 8.8 6 8.8-6" />
    </Icon>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  )
}

/** Handset silhouette — hand-drawn to match this set's stroke geometry rather than borrowed from
 * an icon font (the WhatsApp glyph elsewhere in this file is filled/brand-specific; this one is a
 * plain outline, for the phone FIELD itself rather than a contact channel). */
export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.6 3.5c-1.7.3-2.9 1.9-2.6 3.6.9 5.7 5.6 10.4 11.3 11.3 1.7.3 3.3-.9 3.6-2.6l.3-1.7a1.5 1.5 0 0 0-.9-1.6l-3-1.3a1.5 1.5 0 0 0-1.7.4l-1 1.2a10 10 0 0 1-4.8-4.8l1.2-1a1.5 1.5 0 0 0 .4-1.7l-1.3-3a1.5 1.5 0 0 0-1.6-.9Z" />
    </Icon>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
      <path d="M6.8 6.8C4 8.6 2 12 2 12s3.6 7 10 7c1.4 0 2.6-.3 3.7-.8M10.6 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.5 15.5 0 0 1-3.4 4.3" />
      <path d="M3.5 3.5l17 17" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v16M4 12h16" />
    </Icon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" />
      <path d="M6.5 7 7.3 19.5a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </Icon>
  )
}

/**
 * Tote bag — the cart entry point in both site headers (spec 008 §8.5).
 *
 * Deliberately a soft-shouldered TOTE, not a supermarket trolley: `/cart` collects trip requests
 * that a manager confirms by phone, it is not a checkout with a card form at the end. The body
 * tapers slightly toward the bottom so it reads as fabric rather than as a box, and the handle is
 * a single arc — same 24×24 box, 1.5 stroke, round caps as the rest of the family.
 */
export function BagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.4 8.5h15.2l-1 11.1a1.9 1.9 0 0 1-1.9 1.7H7.3a1.9 1.9 0 0 1-1.9-1.7Z" />
      <path d="M8.7 8.5V6.5a3.3 3.3 0 0 1 6.6 0v2" />
    </Icon>
  )
}

/** Floppy disk — "Save" in the admin toolbar (checklist §1). Same geometry contract as the rest
 * of this set: a folded-corner body, the write-shutter at the top, the label area at the bottom. */
export function SaveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3h11.5L20 6.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
      <path d="M8 3v5h7V3" />
      <path d="M7.5 21v-6.5h9V21" />
    </Icon>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66" />
      <path d="M17.5 3v4h-4M6.5 21v-4h4" />
    </Icon>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </Icon>
  )
}

/** Empty state — nothing found yet, go explore. */
export function CompassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </Icon>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Icon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </Icon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Icon>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20s-7-4.4-7-9.5A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.9c0 5.1-7 9.5-7 9.5Z" />
    </Icon>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  )
}

/** Kebab (vertical three-dot) trigger for `shared/ui/ActionsMenu` — distinct from `MenuIcon`
 * (a hamburger, used for navigation), this one means "more actions for this one row/item". */
export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props} fill="currentColor" stroke="none">
      <circle cx="12" cy="5.5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="18.5" r="1.6" />
    </Icon>
  )
}

export function MapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2Z" />
      <path d="M9 4v14M15 6v14" />
    </Icon>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    </Icon>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  )
}

/**
 * Social glyphs (footer). Reinterpreted as line art in the site's own 24×24/1.5-stroke
 * geometry rather than the brands' own bitmap logos — consistent with the rest of this hand-drawn
 * set, and it means they tint with `currentColor` like everything else here.
 */
export function InstagramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="16.8" cy="7.2" r="0.6" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function FacebookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.2v2.4H7.5v3.1h2.9V21" />
    </Icon>
  )
}

/** Paper-plane silhouette (closed outline + one wing crease) — the old two-stroke arrow read as a generic "send" glyph rather than Telegram. */
export function TelegramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12 21 4 13 21l-2-8Z" strokeLinejoin="round" />
      <path d="M11 13 21 4" />
    </Icon>
  )
}

/** Speech bubble + a proper phone-handset glyph (filled, like the real WhatsApp mark) — the old thin stroke squiggle didn't read as a phone at 17px. */
export function WhatsappIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20l1.4-4.2A8 8 0 1 1 8.6 19L4 20Z" />
      <path
        d="M9.3 8.7c-.4 0-.9.2-1.1.6-.4.5-.6 1.2-.4 2 .4 2 1.6 4 3.4 5.3.7.5 1.6.5 2.2 0l.5-.4c.3-.2.3-.6.1-.9l-1-1.3c-.2-.2-.5-.3-.7-.2-.6.3-1.3.1-1.7-.4-.5-.5-.8-1.1-.9-1.8 0-.3.1-.5.4-.7.2-.2.3-.5.2-.8l-.5-1.5c-.1-.4-.4-.7-.8-.8Z"
        fill="currentColor"
        stroke="none"
      />
    </Icon>
  )
}

export function YoutubeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="18" height="12" rx="4" />
      <path d="M10.5 9.7v4.6l4.2-2.3Z" fill="currentColor" stroke="none" />
    </Icon>
  )
}
