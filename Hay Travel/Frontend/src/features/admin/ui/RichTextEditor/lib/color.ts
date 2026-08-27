/**
 * Colour normalization for the free-form colour picker (spec 011 §3.10).
 *
 * Everything funnels through `toHexColor` so there is exactly one place that decides what a
 * "valid colour" looks like — the same shape the backend will validate against (спека 012 §В):
 * strictly a 6-digit lower-case `#rrggbb`. Alpha is dropped, not rejected: the allow-list has no
 * `rgba()` slot, and a picker's alpha channel is always 1 anyway.
 */

const HEX6_RE = /^#([0-9a-f]{6})$/i
const HEX3_RE = /^#([0-9a-f]{3})$/i
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[0-9.]+\s*)?\)$/i

function clampByte(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(255, Math.max(0, Math.round(value)))
}

function byteToHex(value: string): string {
  return clampByte(Number(value)).toString(16).padStart(2, '0')
}

/**
 * Any CSS colour value coming out of the DOM → `#rrggbb`, or `null`.
 * Understands `#rgb`, `#rrggbb`, `rgb(r, g, b)`, `rgba(r, g, b, a)`. Everything else
 * (`var(...)`, `color-mix(...)`, named colours, `url(...)`) → `null`.
 */
export function toHexColor(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  const hex6 = HEX6_RE.exec(trimmed)
  if (hex6) return `#${hex6[1].toLowerCase()}`

  const hex3 = HEX3_RE.exec(trimmed)
  if (hex3) {
    const [r, g, b] = hex3[1].toLowerCase().split('')
    return `#${r}${r}${g}${g}${b}${b}`
  }

  const rgb = RGB_RE.exec(trimmed)
  if (rgb) return `#${byteToHex(rgb[1])}${byteToHex(rgb[2])}${byteToHex(rgb[3])}`

  return null
}

/**
 * User-typed hex input → `#rrggbb`, or `null` when invalid. Trims whitespace, adds a leading `#`
 * if missing, expands the 3-digit form. Delegates to `toHexColor` so there is one validation rule
 * for both directions (DOM → app, and user input → app).
 */
export function normalizeHexInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  return toHexColor(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
}
