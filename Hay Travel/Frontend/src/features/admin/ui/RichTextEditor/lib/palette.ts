/**
 * Shared colour palette grid for `ColorPicker` (text colour AND highlight — Notification
 * Templates, 2026-08-31 "нормальная палитра" request). Fixed hand-picked values, same idea as
 * Google Docs/Word's grid: one grayscale row, then hue rows from light to dark. No colour maths
 * at runtime — a wrong HSL→hex formula would be a subtle, hard-to-notice bug in every swatch.
 */
export const PALETTE_ROWS: readonly (readonly string[])[] = [
  ['#000000', '#262626', '#404040', '#595959', '#737373', '#8c8c8c', '#a6a6a6', '#bfbfbf', '#d9d9d9', '#ffffff'],
  ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#c7d2fe', '#e9d5ff', '#fbcfe8', '#f5f5f4'],
  ['#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#60a5fa', '#818cf8', '#c084fc', '#f472b6', '#a8a29e'],
  ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#4f46e5', '#9333ea', '#db2777', '#57534e'],
  ['#7f1d1d', '#7c2d12', '#713f12', '#14532d', '#164e63', '#1e3a8a', '#312e81', '#581c87', '#831843', '#292524'],
]
