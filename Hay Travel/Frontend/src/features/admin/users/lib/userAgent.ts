/**
 * "Chrome · Windows" out of a raw User-Agent string, for the login-history list (C2).
 *
 * Deliberately small and deliberately approximate. A real UA parser is a megabyte of regexes that
 * needs updating forever, and this is one line of context in an admin audit list — the raw string is
 * always one hover away (`title=`), so a miss costs nothing and never hides information.
 *
 * Order matters in both tables below: every Chromium browser also says "Chrome", and every one of
 * them says "Safari" too, so the more specific brands have to be tested first. Same on the OS side —
 * Android's UA contains "Linux", and iPadOS's contains "Mac OS X".
 */

const BROWSERS: [RegExp, string][] = [
  // Brand names, not copy: they read the same in both interface languages, so this table stays a
  // plain constant instead of moving into `userCopy`.
  [/YaBrowser\//, 'Yandex Browser'],
  [/Edg[A-Z]?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/CriOS\//, 'Chrome'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const PLATFORMS: [RegExp, string][] = [
  [/Windows NT/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  // iPadOS reports itself as a desktop Mac, so this can only run after the two iOS checks.
  [/Macintosh|Mac OS X/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

function firstMatch(table: [RegExp, string][], value: string): string | null {
  for (const [pattern, label] of table) {
    if (pattern.test(value)) return label
  }
  return null
}

/**
 * Human-readable "browser · platform", either half alone if only one is recognised, or `null` when
 * neither is (a bot, a curl call, a stripped UA) — callers render nothing rather than a guess.
 */
export function describeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null

  const browser = firstMatch(BROWSERS, userAgent)
  const platform = firstMatch(PLATFORMS, userAgent)

  if (browser && platform) return `${browser} · ${platform}`
  return browser ?? platform
}
