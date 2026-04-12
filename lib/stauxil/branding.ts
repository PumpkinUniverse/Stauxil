export const DEFAULT_BRAND_COLOR = '#537dc4'
export const DEFAULT_TIMEZONE = 'UTC'

export const COMMON_TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export function normalizeBrandColor(value: string | null | undefined) {
  const brandColor = value?.trim()

  if (!brandColor || !HEX_COLOR_PATTERN.test(brandColor)) {
    return DEFAULT_BRAND_COLOR
  }

  return brandColor.toLowerCase()
}

export function toRgba(hexColor: string, alpha: number) {
  const normalized = normalizeBrandColor(hexColor).slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function getBrandBackground(brandColor: string) {
  const normalized = normalizeBrandColor(brandColor)

  return `radial-gradient(circle_at_top_left, ${toRgba(normalized, 0.18)}, transparent 36%), linear-gradient(180deg, rgba(248,250,252,0.96), rgba(241,245,249,0.92))`
}

export function getBrandIconStyle(brandColor: string) {
  const normalized = normalizeBrandColor(brandColor)

  return {
    backgroundColor: toRgba(normalized, 0.12),
    color: normalized,
  }
}

export function getBrandButtonStyle(brandColor: string) {
  const normalized = normalizeBrandColor(brandColor)

  return {
    backgroundColor: normalized,
    borderColor: normalized,
    color: getContrastingTextColor(normalized),
  }
}

function getContrastingTextColor(hexColor: string) {
  const normalized = normalizeBrandColor(hexColor).slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000

  return brightness > 160 ? '#0f172a' : '#ffffff'
}

export function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function isValidHexColor(value: string) {
  return HEX_COLOR_PATTERN.test(value.trim())
}

export function isValidTimeZone(value: string) {
  const timeZone = value.trim()

  if (!timeZone) {
    return false
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function isValidLogoUrl(value: string) {
  const logoUrl = value.trim()

  if (!logoUrl) {
    return true
  }

  try {
    const parsedUrl = new URL(logoUrl)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}
