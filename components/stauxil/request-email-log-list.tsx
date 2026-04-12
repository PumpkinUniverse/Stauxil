import { Mail } from 'lucide-react'
import { formatDateTime, formatRelativeDateTime } from '@/components/stauxil/request-badges'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  EMAIL_DELIVERY_MODE_LABELS,
  EMAIL_LOG_STATUS_LABELS,
  EMAIL_PROVIDER_LABELS,
  EMAIL_SENDER_SOURCE_LABELS,
  type EmailDeliveryMode,
  type EmailLogStatus,
  type EmailProviderName,
  type EmailSenderSource,
} from '@/lib/stauxil/constants'

type RequestEmailLog = {
  id: string
  createdAt: number
  sentAt: number | null
  toEmail: string
  fromEmail: string | null
  replyToEmail: string | null
  senderSource: string | null
  providerName: string | null
  subject: string
  body: string
  status: string
  deliveryMode: string | null
  templateLabel: string
  createdByLabel: string
  errorMessage: string | null
}

export function RequestEmailLogList({
  emailLogs,
}: {
  emailLogs: RequestEmailLog[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email log</CardTitle>
        <CardDescription>
          Outbound and logged template email activity appears here with recipient, effective sender,
          status, and rendered message content.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {emailLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No email activity has been logged for this request yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {emailLogs.map((emailLog) => {
              const sentTimestamp = emailLog.sentAt ?? emailLog.createdAt
              const statusLabel =
                EMAIL_LOG_STATUS_LABELS[emailLog.status as EmailLogStatus] ?? emailLog.status
              const deliveryModeLabel =
                emailLog.deliveryMode === null
                  ? 'Unspecified'
                  : EMAIL_DELIVERY_MODE_LABELS[emailLog.deliveryMode as EmailDeliveryMode] ??
                    emailLog.deliveryMode
              const senderSourceLabel =
                emailLog.senderSource === null
                  ? null
                  : EMAIL_SENDER_SOURCE_LABELS[emailLog.senderSource as EmailSenderSource] ??
                    emailLog.senderSource
              const providerLabel =
                emailLog.providerName === null
                  ? null
                  : EMAIL_PROVIDER_LABELS[emailLog.providerName as EmailProviderName] ??
                    emailLog.providerName

              return (
                <div key={emailLog.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="size-4 text-primary" />
                        {emailLog.templateLabel}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{emailLog.subject}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{statusLabel}</Badge>
                      <Badge variant="outline">{deliveryModeLabel}</Badge>
                      {senderSourceLabel ? <Badge variant="outline">{senderSourceLabel}</Badge> : null}
                      {providerLabel ? <Badge variant="outline">{providerLabel}</Badge> : null}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">To:</span> {emailLog.toEmail}
                    </p>
                    {emailLog.fromEmail ? (
                      <p>
                        <span className="font-medium text-foreground">From:</span>{' '}
                        {emailLog.fromEmail}
                      </p>
                    ) : null}
                    {emailLog.replyToEmail ? (
                      <p>
                        <span className="font-medium text-foreground">Reply-To:</span>{' '}
                        {emailLog.replyToEmail}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-medium text-foreground">Logged by:</span>{' '}
                      {emailLog.createdByLabel}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Timestamp:</span>{' '}
                      {formatDateTime(sentTimestamp)} ({formatRelativeDateTime(sentTimestamp)})
                    </p>
                    {emailLog.errorMessage ? (
                      <p>
                        <span className="font-medium text-foreground">Error:</span>{' '}
                        {emailLog.errorMessage}
                      </p>
                    ) : null}
                  </div>

                  <details className="mt-3 rounded-2xl border border-border bg-background px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      View rendered message
                    </summary>
                    <div className="mt-3 grid gap-2 text-sm">
                      <p className="font-medium text-foreground">Subject</p>
                      <p className="text-muted-foreground">{emailLog.subject}</p>
                      <p className="font-medium text-foreground">Body</p>
                      <div className="rounded-xl bg-muted/40 p-3 font-mono text-xs leading-6 whitespace-pre-wrap text-foreground">
                        {emailLog.body}
                      </div>
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
