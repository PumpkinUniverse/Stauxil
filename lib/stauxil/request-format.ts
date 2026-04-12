import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type RequestStatus,
  type RequestType,
  type VerificationStatus,
} from '@/lib/stauxil/constants'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function formatCalendarDate(value: number | null) {
  if (value === null) {
    return 'No due date'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

export function formatDateTime(value: number | null) {
  if (value === null) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

export function formatRelativeDateTime(value: number) {
  const now = Date.now()
  const delta = value - now
  const minutes = Math.round(delta / (60 * 1000))

  if (Math.abs(minutes) < 60) {
    return new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(minutes, 'minute')
  }

  const hours = Math.round(delta / (60 * 60 * 1000))
  if (Math.abs(hours) < 24) {
    return new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(hours, 'hour')
  }

  const days = Math.round(delta / DAY_IN_MS)
  return new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(days, 'day')
}

export function formatRequestTypeLabel(value: RequestType | string) {
  return REQUEST_TYPE_LABELS[value as RequestType] ?? titleize(value)
}

export function formatRequestStatusLabel(value: RequestStatus | string) {
  return REQUEST_STATUS_LABELS[value as RequestStatus] ?? titleize(value)
}

export function formatVerificationStatusLabel(value: VerificationStatus | string) {
  return VERIFICATION_STATUS_LABELS[value as VerificationStatus] ?? titleize(value)
}

export function titleize(value: string) {
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}
