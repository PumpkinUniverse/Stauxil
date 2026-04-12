import Link from 'next/link'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import { RequestPrintActions } from '@/components/stauxil/request-print-actions'
import {
  DueDateBadge,
  RequestStatusBadge,
  VerificationStatusBadge,
} from '@/components/stauxil/request-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  formatCalendarDate,
  formatDateTime,
  formatRequestTypeLabel,
  titleize,
} from '@/lib/stauxil/request-format'
import { getConvexServerAuth } from '@/lib/stauxil/server-auth'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  return {
    title: `Print ${id}`,
    description: 'Printable request summary with case details, notes, and recent activity.',
  }
}

export default async function RequestPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ workspaceId?: string }>
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const workspaceId = resolvedSearchParams.workspaceId?.trim()

  if (!workspaceId) {
    return (
      <PrintStateCard
        badge="Missing workspace"
        title="This summary needs a workspace context"
        description="Open the print view from a request inside the app so the workspace-scoped summary can be loaded safely."
      />
    )
  }

  const { clerkAuth, token } = await getConvexServerAuth()

  if (!clerkAuth.userId) {
    clerkAuth.redirectToSignIn()
  }

  if (!token) {
    return (
      <PrintStateCard
        badge="Authorization issue"
        title="We could not authorize this printable summary"
        description="Refresh the app session and try again."
      />
    )
  }

  try {
    const billing = await fetchQuery(
      api.workspaces.getBillingSnapshot,
      {
        workspaceId: workspaceId as Id<'workspaces'>,
      },
      { token }
    )

    if (!billing.features.exportsEnabled) {
      return (
        <PrintStateCard
          badge="Upgrade required"
          title="Printable summaries are on paid plans"
          description={
            billing.messages.exports ?? 'Upgrade the workspace plan to export request data.'
          }
          actionHref="/billing"
          actionLabel="Open billing"
        />
      )
    }

    const detail = await fetchQuery(
      api.requests.getDetailByCaseId,
      {
        workspaceId: workspaceId as Id<'workspaces'>,
        caseId: id,
        eventLimit: 100,
        noteLimit: 50,
        emailLogLimit: 10,
      },
      { token }
    )

    if (detail === null) {
      return (
        <PrintStateCard
          badge="Request not found"
          title="We could not load that case summary"
          description="The case may not exist in this workspace, or it may no longer be available."
        />
      )
    }

    const request = detail.request
    const notesSummary = buildNotesSummary(detail.notes)
    const emailSummary = buildEmailSummary(detail.emailLogs)
    const timelineSummary = buildTimelineSummary(detail.events)
    const requesterMatchesSubject =
      request.requester.email === request.subject.email &&
      (request.requester.name ?? '') === (request.subject.name ?? '')
    const exportHref = `/api/exports/requests?workspaceId=${encodeURIComponent(workspaceId)}`

    return (
      <div className="min-h-screen bg-white text-slate-950">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
          <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`/requests/${encodeURIComponent(request.caseId)}`}>
                  <ArrowLeft />
                  Back to request
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href={exportHref}>
                  <Download />
                  Export workspace CSV
                </a>
              </Button>
            </div>
            <RequestPrintActions />
          </div>

          <article className="rounded-3xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-none print:shadow-none">
            <header className="border-b border-slate-200 px-6 py-6 print:px-0">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    Printable case summary
                  </Badge>
                  <Badge variant="secondary">{request.caseId}</Badge>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                    {formatRequestTypeLabel(request.requestType)}
                  </span>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex max-w-3xl flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <FileText className="size-4" />
                      Operational report
                    </div>
                    <div className="flex flex-col gap-2">
                      <h1 className="text-3xl font-semibold tracking-tight">{request.title}</h1>
                      <p className="text-sm leading-6 text-slate-600">
                        {request.description?.trim() || 'No request summary has been added yet.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <RequestStatusBadge status={request.status} />
                    <VerificationStatusBadge status={request.verificationStatus} />
                    <DueDateBadge dueAt={request.dueAt} status={request.status} />
                  </div>
                </div>
              </div>
            </header>

            <div className="grid gap-6 px-6 py-6 print:px-0">
              <section className="grid gap-4 md:grid-cols-2">
                <ReportSection
                  title="Case Overview"
                  description="Core metadata for routing, tracking, and handoff."
                  items={[
                    { label: 'Request type', value: formatRequestTypeLabel(request.requestType) },
                    { label: 'Status', value: titleize(request.status) },
                    { label: 'Verification', value: titleize(request.verificationStatus) },
                    { label: 'Due date', value: formatCalendarDate(request.dueAt) },
                    { label: 'Created at', value: formatDateTime(request.submittedAt) },
                    {
                      label: 'Closed at',
                      value:
                        request.closedAt === null
                          ? request.isClosed
                            ? 'Tracked in activity log'
                            : 'Still open'
                          : formatDateTime(request.closedAt),
                    },
                  ]}
                />

                <ReportSection
                  title="Requester"
                  description="Who submitted the request and who it applies to."
                  items={[
                    {
                      label: 'Requester',
                      value: request.requester.name?.trim() || 'Name not provided',
                    },
                    { label: 'Requester email', value: request.requester.email },
                    {
                      label: 'Subject',
                      value: requesterMatchesSubject
                        ? 'Same as requester'
                        : request.subject.name?.trim() || 'Name not provided',
                    },
                    {
                      label: 'Subject email',
                      value: requesterMatchesSubject ? request.requester.email : request.subject.email,
                    },
                    {
                      label: 'Jurisdiction',
                      value: request.jurisdiction?.trim() || 'Not provided',
                    },
                    {
                      label: 'Account reference',
                      value: request.accountReference?.trim() || 'Not provided',
                    },
                  ]}
                />
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                <ReportSection
                  title="Notes Summary"
                  description="Recent note context captured for the case."
                  items={[{ label: 'Summary', value: notesSummary }]}
                />

                <ReportSection
                  title="Email Summary"
                  description="Recent outbound activity logged for this case."
                  items={[{ label: 'Summary', value: emailSummary }]}
                />

                <ReportSection
                  title="Timeline Summary"
                  description="Recent case activity and status movement."
                  items={[{ label: 'Summary', value: timelineSummary }]}
                />
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <Card className="border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                    <CardDescription>Most recent notes included in this printable view.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {detail.notes.length === 0 ? (
                      <p className="text-sm text-slate-600">No notes have been added to this case.</p>
                    ) : (
                      detail.notes.map((note) => (
                        <div key={note.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span className="font-medium text-slate-900">{note.authorLabel}</span>
                            <span>{formatDateTime(note.createdAt)}</span>
                            <span>{note.isInternal ? 'Internal note' : 'Shared note'}</span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">{note.body}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle>Email history</CardTitle>
                    <CardDescription>Recent request email activity included in this summary.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {detail.emailLogs.length === 0 ? (
                      <p className="text-sm text-slate-600">
                        No email history has been logged for this case.
                      </p>
                    ) : (
                      detail.emailLogs.map((emailLog) => {
                        const timestamp = emailLog.sentAt ?? emailLog.createdAt

                        return (
                          <div key={emailLog.id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                              <span className="font-medium text-slate-900">{emailLog.templateLabel}</span>
                              <span>{emailLog.toEmail}</span>
                              <span>{titleize(emailLog.status)}</span>
                              <span>{formatDateTime(timestamp)}</span>
                            </div>
                            <p className="mt-3 text-sm font-medium text-slate-900">{emailLog.subject}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {truncateSummary(collapseWhitespace(emailLog.body), 240)}
                            </p>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-none">
                  <CardHeader>
                    <CardTitle>Timeline</CardTitle>
                    <CardDescription>Recent activity recorded against the request.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {detail.events.length === 0 ? (
                      <p className="text-sm text-slate-600">
                        No timeline activity has been recorded for this case.
                      </p>
                    ) : (
                      detail.events.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span className="font-medium text-slate-900">{event.actorLabel}</span>
                            <span>{formatDateTime(event.createdAt)}</span>
                            <span>{titleize(event.eventType)}</span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            {event.message?.trim() || 'Activity recorded without a message.'}
                          </p>
                          {event.details && Object.keys(event.details).length > 0 ? (
                            <dl className="mt-3 grid gap-1 text-sm text-slate-600">
                              {Object.entries(event.details).map(([key, value]) => (
                                <div key={key} className="flex flex-wrap gap-2">
                                  <dt className="font-medium text-slate-900">{titleize(key)}:</dt>
                                  <dd>{value}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </section>
            </div>
          </article>
        </div>
      </div>
    )
  } catch {
    return (
      <PrintStateCard
        badge="Summary unavailable"
        title="We could not load the printable case summary"
        description="Try returning to the request and opening the summary again."
      />
    )
  }
}

function ReportSection({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: Array<{ label: string; value: string }>
}) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {item.label}
            </span>
            <p className="text-sm leading-6 text-slate-900">{item.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PrintStateCard({
  badge,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  badge: string
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="min-h-screen bg-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-slate-200 shadow-none">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              {badge}
            </Badge>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          {actionHref && actionLabel ? (
            <CardContent>
              <Button asChild variant="outline">
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

function buildNotesSummary(
  notes: Array<{
    body: string
    isInternal: boolean
  }>
) {
  if (notes.length === 0) {
    return 'No notes have been added to this case.'
  }

  return truncateSummary(
    notes
      .slice(0, 3)
      .map((note) => `${note.isInternal ? 'Internal' : 'Shared'}: ${collapseWhitespace(note.body)}`)
      .join(' | '),
    300
  )
}

function buildTimelineSummary(
  events: Array<{
    createdAt: number
    eventType: string
    message: string | null
  }>
) {
  if (events.length === 0) {
    return 'No activity has been recorded for this case yet.'
  }

  const summaryItems = events.slice(0, 4).map((event) => {
    const message = collapseWhitespace(event.message ?? titleize(event.eventType))
    return `${formatDateTime(event.createdAt)} - ${message}`
  })

  return truncateSummary(summaryItems.join(' | '), 360)
}

function buildEmailSummary(
  emailLogs: Array<{
    createdAt: number
    sentAt: number | null
    toEmail: string
    subject: string
    status: string
    templateLabel: string
  }>
) {
  if (emailLogs.length === 0) {
    return 'No email history has been logged for this case yet.'
  }

  const summaryItems = emailLogs.slice(0, 3).map((emailLog) => {
    const timestamp = emailLog.sentAt ?? emailLog.createdAt
    return `${formatDateTime(timestamp)} - ${emailLog.templateLabel} to ${emailLog.toEmail} (${titleize(emailLog.status)})`
  })

  return truncateSummary(summaryItems.join(' | '), 320)
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function truncateSummary(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}
