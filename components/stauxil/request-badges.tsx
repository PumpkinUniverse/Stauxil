import {
  CLOSED_REQUEST_STATUS_VALUES,
  REQUEST_STATUS_LABELS,
  type RequestStatus,
  type VerificationStatus,
} from '@/lib/stauxil/constants'
import {
  formatCalendarDate,
  formatDateTime,
  formatRelativeDateTime,
  formatRequestTypeLabel,
  formatVerificationStatusLabel,
  titleize,
} from '@/lib/stauxil/request-format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const CLOSED_REQUEST_STATUS_SET = new Set<RequestStatus>(CLOSED_REQUEST_STATUS_VALUES)
const DAY_IN_MS = 24 * 60 * 60 * 1000

export function RequestStatusBadge({
  status,
  className,
}: {
  status: RequestStatus
  className?: string
}) {
  return (
    <Badge className={cn(statusBadgeClassNames[status], className)} variant="secondary">
      {REQUEST_STATUS_LABELS[status]}
    </Badge>
  )
}

export function VerificationStatusBadge({
  status,
  className,
}: {
  status: VerificationStatus
  className?: string
}) {
  return (
    <Badge className={cn(verificationBadgeClassNames[status], className)} variant="outline">
      {formatVerificationStatusLabel(status)}
    </Badge>
  )
}

export function DueDateBadge({
  dueAt,
  status,
  className,
}: {
  dueAt: number | null
  status: RequestStatus
  className?: string
}) {
  const presentation = getDueDatePresentation(dueAt, status)

  return (
    <Badge className={cn(presentation.className, className)} variant="outline">
      {presentation.label}
    </Badge>
  )
}

export { formatCalendarDate, formatDateTime, formatRelativeDateTime, formatRequestTypeLabel }

export function formatEventDetailLabel(value: string) {
  return titleize(value)
}

function getDueDatePresentation(dueAt: number | null, status: RequestStatus) {
  if (dueAt === null) {
    return {
      label: 'No due date',
      className: 'border-dashed text-muted-foreground',
    }
  }

  const formattedDate = formatCalendarDate(dueAt)
  if (CLOSED_REQUEST_STATUS_SET.has(status)) {
    return {
      label: formattedDate,
      className: 'border-slate-300 text-slate-600',
    }
  }

  const timeUntilDue = dueAt - Date.now()
  if (timeUntilDue < 0) {
    return {
      label: `Overdue: ${formattedDate}`,
      className: 'border-rose-300 bg-rose-500/10 text-rose-700',
    }
  }

  if (timeUntilDue < DAY_IN_MS) {
    return {
      label: `Due soon: ${formattedDate}`,
      className: 'border-amber-300 bg-amber-500/10 text-amber-700',
    }
  }

  if (timeUntilDue < 3 * DAY_IN_MS) {
    return {
      label: `Upcoming: ${formattedDate}`,
      className: 'border-sky-300 bg-sky-500/10 text-sky-700',
    }
  }

  return {
    label: `Due: ${formattedDate}`,
    className: 'border-slate-300 text-slate-700',
  }
}

const statusBadgeClassNames: Record<RequestStatus, string> = {
  received: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  in_progress: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  waiting_on_requester: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  cancelled: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
}

const verificationBadgeClassNames: Record<VerificationStatus, string> = {
  not_required: 'border-slate-300 text-slate-600',
  pending: 'border-amber-300 bg-amber-500/10 text-amber-700',
  verified: 'border-emerald-300 bg-emerald-500/10 text-emerald-700',
  expired: 'border-rose-300 bg-rose-500/10 text-rose-700',
  failed: 'border-rose-300 bg-rose-500/10 text-rose-700',
}
