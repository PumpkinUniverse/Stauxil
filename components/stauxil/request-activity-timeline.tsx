'use client'

import {
  CircleAlert,
  Clock3,
  FileText,
  Mail,
  ShieldCheck,
  StickyNote,
} from 'lucide-react'
import {
  formatDateTime,
  formatEventDetailLabel,
  formatRelativeDateTime,
} from '@/components/stauxil/request-badges'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type RequestTimelineEvent = {
  id: string
  createdAt: number
  actorLabel: string
  eventType: string
  message: string | null
  details: Record<string, string> | null
}

export function RequestActivityTimeline({
  events,
}: {
  events: RequestTimelineEvent[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity timeline</CardTitle>
        <CardDescription>
          Request events only. Notes, status changes, verification steps, and logged email
          activity appear here for the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No activity has been logged for this request yet.
          </div>
        ) : (
          <div className="relative flex flex-col gap-5 pl-4">
            <div className="absolute top-2 bottom-2 left-7 w-px bg-border" />
            {events.map((event) => {
              const presentation = getTimelinePresentation(event.eventType)
              const Icon = presentation.icon

              return (
                <div key={event.id} className="relative flex gap-4">
                  <div
                    className={cn(
                      'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-background shadow-sm',
                      presentation.className
                    )}
                  >
                    <Icon className="size-4" />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">
                        {event.message ?? formatEventDetailLabel(event.eventType)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.actorLabel} - {formatDateTime(event.createdAt)} (
                        {formatRelativeDateTime(event.createdAt)})
                      </p>
                    </div>

                    {event.details && Object.keys(event.details).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(event.details).map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">
                              {formatEventDetailLabel(key)}:
                            </span>{' '}
                            {value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getTimelinePresentation(eventType: string) {
  if (eventType.includes('note')) {
    return {
      icon: StickyNote,
      className: 'bg-amber-500/10 text-amber-700',
    }
  }

  if (eventType.includes('email')) {
    return {
      icon: Mail,
      className: 'bg-sky-500/10 text-sky-700',
    }
  }

  if (eventType.includes('verification')) {
    return {
      icon: ShieldCheck,
      className: 'bg-emerald-500/10 text-emerald-700',
    }
  }

  if (eventType.includes('status') || eventType.includes('closed')) {
    return {
      icon: Clock3,
      className: 'bg-blue-500/10 text-blue-700',
    }
  }

  if (eventType.includes('request')) {
    return {
      icon: FileText,
      className: 'bg-zinc-500/10 text-zinc-700',
    }
  }

  return {
    icon: CircleAlert,
    className: 'bg-primary/10 text-primary',
  }
}
