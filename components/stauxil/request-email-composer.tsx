'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Send } from 'lucide-react'
import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EMAIL_TEMPLATE_LABELS, type EmailTemplateKey } from '@/lib/stauxil/constants'
import { cn } from '@/lib/utils'

type FeedbackState =
  | {
      kind: 'success' | 'error'
      message: string
    }
  | null

export function RequestEmailComposer({
  workspaceId,
  requestId,
}: {
  workspaceId: Id<'workspaces'>
  requestId: Id<'requests'>
}) {
  const templates = useQuery(api.emailTemplates.listEffectiveByWorkspace, {
    workspaceId,
  })
  const sendTemplate = useMutation(api.requestEmails.sendTemplate)

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<EmailTemplateKey>('acknowledgment')
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [isSending, setIsSending] = useState(false)
  const isVerificationTemplate = selectedTemplateKey === 'verification'

  useEffect(() => {
    if (!templates || templates.length === 0) {
      return
    }

    const selectedStillExists = templates.some((template) => template.key === selectedTemplateKey)
    if (!selectedStillExists) {
      setSelectedTemplateKey(templates[0].key)
    }
  }, [selectedTemplateKey, templates])

  const preview = useQuery(api.requestEmails.renderPreview, {
    workspaceId,
    requestId,
    templateKey: selectedTemplateKey,
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setIsSending(true)

    try {
      await sendTemplate({
        workspaceId,
        requestId,
        templateKey: selectedTemplateKey,
      })

      setFeedback({
        kind: 'success',
        message: isVerificationTemplate
          ? `${EMAIL_TEMPLATE_LABELS[selectedTemplateKey]} email queued for provider delivery.`
          : `${EMAIL_TEMPLATE_LABELS[selectedTemplateKey]} email logged for this request.`,
      })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Email preview and log</CardTitle>
          <Badge variant="secondary">
            {isVerificationTemplate ? 'Provider send' : 'Logged only'}
          </Badge>
        </div>
        <CardDescription>
          {isVerificationTemplate
            ? 'Verification emails are queued for outbound provider delivery and written to the request audit trail.'
            : 'Preview the rendered email, then record it on the request. Each entry creates both an activity event and an email log record.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium">
            Template
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={selectedTemplateKey}
              onChange={(event) => setSelectedTemplateKey(event.target.value as EmailTemplateKey)}
              disabled={isSending || templates === undefined}
            >
              {templates?.map((template) => (
                <option key={template.key} value={template.key}>
                  {EMAIL_TEMPLATE_LABELS[template.key]}
                  {template.isEnabled ? '' : ' (disabled)'}
                </option>
              ))}
            </select>
          </label>

          {preview === undefined ? (
            <RequestEmailPreviewSkeleton />
          ) : (
            <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{preview.toEmail}</Badge>
                <Badge variant={preview.isEnabled ? 'outline' : 'secondary'}>
                  {preview.isEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Subject
                </span>
                <p className="text-sm font-medium">{preview.subject}</p>
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Body preview
                </span>
                <div className="rounded-2xl border border-border bg-background p-4 text-sm leading-6 whitespace-pre-wrap">
                  {preview.body}
                </div>
              </div>
            </div>
          )}

          {preview !== undefined && !preview.isEnabled ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
              This template is disabled in workspace settings. Re-enable it on the Templates page
              before logging it from this request.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSending || preview === undefined || !preview.isEnabled}>
              <Send />
              {isSending
                ? isVerificationTemplate
                  ? 'Queueing email...'
                  : 'Logging email...'
                : isVerificationTemplate
                  ? 'Send email'
                  : 'Log email'}
            </Button>
            <FeedbackMessage feedback={feedback} />
          </div>

          <p className="text-sm text-muted-foreground">
            Verification uses the configured delivery provider. Other templates stay inside
            Stauxil as logged-only history for this MVP.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

function FeedbackMessage({ feedback }: { feedback: FeedbackState }) {
  if (feedback === null) {
    return null
  }

  return (
    <p
      className={cn(
        'text-sm',
        feedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'
      )}
    >
      {feedback.message}
    </p>
  )
}

function RequestEmailPreviewSkeleton() {
  return (
    <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-36 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'We could not log that email. Refresh the request and try again.'
}
