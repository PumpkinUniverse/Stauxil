'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MailCheck,
  Printer,
  ShieldAlert,
  UserRoundCheck,
} from 'lucide-react'
import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import { useActiveWorkspace } from '@/components/stauxil/app-shell'
import { RequestActivityTimeline } from '@/components/stauxil/request-activity-timeline'
import {
  DueDateBadge,
  RequestStatusBadge,
  VerificationStatusBadge,
  formatCalendarDate,
  formatDateTime,
  formatRequestTypeLabel,
} from '@/components/stauxil/request-badges'
import { RequestEmailComposer } from '@/components/stauxil/request-email-composer'
import { RequestEmailLogList } from '@/components/stauxil/request-email-log-list'
import { RequestNotesPanel } from '@/components/stauxil/request-notes-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  REQUEST_STATUS_LABELS,
  type ActiveRequestStatus,
  type ClosedRequestStatus,
  type VerificationStatus,
} from '@/lib/stauxil/constants'
import { cn } from '@/lib/utils'

type RequestDetailPageProps = {
  caseId: string
}

type FeedbackState =
  | {
      kind: 'success' | 'error'
      message: string
    }
  | null

export function RequestDetailPage({ caseId }: RequestDetailPageProps) {
  const { workspaceId, workspaceName } = useActiveWorkspace()
  const detail = useQuery(api.requests.getDetailByCaseId, {
    workspaceId,
    caseId,
    eventLimit: 25,
    noteLimit: 20,
    emailLogLimit: 20,
  })
  const billing = useQuery(api.workspaces.getBillingSnapshot, {
    workspaceId,
  })
  const assignOwner = useMutation(api.requests.assignOwner)
  const updateStatus = useMutation(api.requests.updateStatus)
  const closeRequest = useMutation(api.requests.closeRequest)
  const createNote = useMutation(api.requestNotes.create)
  const resendVerification = useMutation(api.verification.createToken)
  const markVerifiedManually = useMutation(api.verification.markVerifiedManually)

  const [ownerValue, setOwnerValue] = useState('unassigned')
  const [statusValue, setStatusValue] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [closeStatusValue, setCloseStatusValue] = useState('completed')
  const [closeNote, setCloseNote] = useState('')

  const [ownerFeedback, setOwnerFeedback] = useState<FeedbackState>(null)
  const [statusFeedback, setStatusFeedback] = useState<FeedbackState>(null)
  const [closeFeedback, setCloseFeedback] = useState<FeedbackState>(null)
  const [verificationFeedback, setVerificationFeedback] = useState<FeedbackState>(null)

  const [isAssigningOwner, setIsAssigningOwner] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isClosingRequest, setIsClosingRequest] = useState(false)
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [isMarkingVerified, setIsMarkingVerified] = useState(false)

  useEffect(() => {
    if (!detail) {
      return
    }

    setOwnerValue(detail.request.owner?.id ?? 'unassigned')
    setStatusValue(detail.availableStatusTransitions[0] ?? '')
    setStatusNote('')
    setCloseStatusValue(detail.availableCloseStatuses[0] ?? 'completed')
    setCloseNote('')
  }, [detail])

  if (detail === undefined) {
    return <RequestDetailLoadingState />
  }

  if (detail === null) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Request not found
            </Badge>
            <CardTitle>We could not find that request in {workspaceName}</CardTitle>
            <CardDescription>
              The case ID may be wrong, or the request may no longer be available in this
              workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/requests">
                <ArrowLeft />
                Back to requests
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const request = detail.request
  const members = detail.members
  const notes = detail.notes
  const events = detail.events
  const emailLogs = detail.emailLogs
  const availableStatusTransitions = detail.availableStatusTransitions
  const availableCloseStatuses = detail.availableCloseStatuses
  const isClosed = request.isClosed
  const currentOwnerLabel = request.owner?.name?.trim() || request.owner?.email?.trim() || 'Unassigned'
  const verificationSummary = getVerificationSummary(request.verificationStatus)
  const dueDateAlert = getDueDateAlert(request.dueAt, request.status)
  const requesterMatchesSubject =
    request.requester.email === request.subject.email &&
    (request.requester.name ?? '') === (request.subject.name ?? '')

  async function handleAssignOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOwnerFeedback(null)
    setIsAssigningOwner(true)

    try {
      const assignedMemberId =
        ownerValue === 'unassigned' ? null : (ownerValue as Id<'workspaceMembers'>)

      await assignOwner({
        workspaceId,
        requestId: request.id,
        assignedMemberId,
      })

      const nextOwner = members.find((member) => member.id === assignedMemberId)
      const nextOwnerLabel =
        assignedMemberId === null
          ? 'Unassigned'
          : nextOwner?.name?.trim() || nextOwner?.email?.trim() || 'Assigned owner'

      setOwnerFeedback({
        kind: 'success',
        message:
          assignedMemberId === null
            ? 'Owner cleared for this request.'
            : `Assigned ${nextOwnerLabel} as owner.`,
      })
    } catch (error) {
      setOwnerFeedback({
        kind: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsAssigningOwner(false)
    }
  }

  async function handleUpdateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!statusValue) {
      setStatusFeedback({
        kind: 'error',
        message: 'Select the next working status first.',
      })
      return
    }

    setStatusFeedback(null)
    setIsUpdatingStatus(true)

    try {
      await updateStatus({
        workspaceId,
        requestId: request.id,
        status: statusValue as ActiveRequestStatus,
        note: statusNote.trim() || undefined,
      })

      setStatusFeedback({
        kind: 'success',
        message: `Status updated to ${REQUEST_STATUS_LABELS[statusValue as ActiveRequestStatus]}.`,
      })
      setStatusNote('')
    } catch (error) {
      setStatusFeedback({
        kind: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  async function handleCloseRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCloseFeedback(null)
    setIsClosingRequest(true)

    try {
      await closeRequest({
        workspaceId,
        requestId: request.id,
        status: closeStatusValue as ClosedRequestStatus,
        note: closeNote.trim() || undefined,
      })

      setCloseFeedback({
        kind: 'success',
        message: `Request closed as ${REQUEST_STATUS_LABELS[closeStatusValue as ClosedRequestStatus]}.`,
      })
      setCloseNote('')
    } catch (error) {
      setCloseFeedback({
        kind: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsClosingRequest(false)
    }
  }

  async function handleCreateNote(body: string) {
    await createNote({
      workspaceId,
      requestId: request.id,
      body,
      isInternal: true,
    })
  }

  async function handleResendVerification() {
    setVerificationFeedback(null)
    setIsResendingVerification(true)

    try {
      await resendVerification({
        workspaceId,
        requestId: request.id,
      })

      setVerificationFeedback({
        kind: 'success',
        message: 'Queued a fresh verification email and logged the action on this request.',
      })
    } catch (error) {
      setVerificationFeedback({
        kind: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsResendingVerification(false)
    }
  }

  async function handleMarkVerifiedManually() {
    setVerificationFeedback(null)
    setIsMarkingVerified(true)

    try {
      await markVerifiedManually({
        workspaceId,
        requestId: request.id,
      })

      setVerificationFeedback({
        kind: 'success',
        message: 'Marked the requester email as verified manually and recorded it in the timeline.',
      })
    } catch (error) {
      setVerificationFeedback({
        kind: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsMarkingVerified(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-border bg-background p-6 shadow-xs">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="sm" variant="outline">
              <Link href="/requests">
                <ArrowLeft />
                Back to requests
              </Link>
            </Button>
            <Badge variant="secondary">{request.caseId}</Badge>
            <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium">
              {formatRequestTypeLabel(request.requestType)}
            </span>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex max-w-3xl flex-col gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{request.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {request.description?.trim() || 'No request summary has been added yet.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <RequestStatusBadge status={request.status} />
              <VerificationStatusBadge status={request.verificationStatus} />
              <DueDateBadge dueAt={request.dueAt} status={request.status} />
              {billing?.features.exportsEnabled === false ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/billing">
                    <Printer />
                    Upgrade to print
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/print/requests/${encodeURIComponent(request.caseId)}?workspaceId=${encodeURIComponent(workspaceId)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Printer />
                    Print summary
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {billing?.features.exportsEnabled === false ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">Exports are locked on {billing.planLabel}</p>
          <p className="mt-2">{billing.messages.exports}</p>
        </div>
      ) : null}

      {dueDateAlert ? (
        <div
          className={cn(
            'rounded-2xl border px-4 py-4 text-sm',
            dueDateAlert.tone === 'danger'
              ? 'border-rose-300 bg-rose-500/10 text-rose-900'
              : 'border-amber-300 bg-amber-500/10 text-amber-900'
          )}
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="font-medium">{dueDateAlert.title}</p>
              <p>{dueDateAlert.description}</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Request Summary</CardTitle>
              <CardDescription>Core case metadata for routing and fulfillment.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailItem
                label="Request type"
                value={formatRequestTypeLabel(request.requestType)}
              />
              <DetailItem label="Status" value={REQUEST_STATUS_LABELS[request.status]} />
              <DetailItem label="Submitted" value={formatDateTime(request.submittedAt)} />
              <DetailItem label="Due date" value={formatCalendarDate(request.dueAt)} />
              <DetailItem
                label="Jurisdiction"
                value={request.jurisdiction?.trim() || 'Not provided'}
              />
              <DetailItem
                label="Account reference"
                value={request.accountReference?.trim() || 'Not provided'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requester Info</CardTitle>
              <CardDescription>Who submitted the request and who it applies to.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Requester
                </p>
                <p className="font-medium">{request.requester.name?.trim() || 'Name not provided'}</p>
                <p className="text-sm text-muted-foreground">{request.requester.email}</p>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Subject
                </p>
                {requesterMatchesSubject ? (
                  <p className="text-sm text-muted-foreground">Same as requester</p>
                ) : (
                  <>
                    <p className="font-medium">
                      {request.subject.name?.trim() || 'Name not provided'}
                    </p>
                    <p className="text-sm text-muted-foreground">{request.subject.email}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification State</CardTitle>
              <CardDescription>
                Current requester verification state for this case.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <VerificationStatusBadge status={request.verificationStatus} />
                <span className="text-sm text-muted-foreground">{verificationSummary}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Verification email" value={request.requester.email} />
                <DetailItem
                  label="Verified at"
                  value={
                    request.verifiedAt === null ? 'Not verified yet' : formatDateTime(request.verifiedAt)
                  }
                />
              </div>
              {request.verificationStatus !== 'verified' &&
              request.verificationStatus !== 'not_required' ? (
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">Verification actions</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Queue a fresh verification email or mark the requester as verified manually for
                    an edge case. Both actions write to the request audit trail.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResendVerification}
                      disabled={isResendingVerification || isMarkingVerified}
                    >
                      <MailCheck />
                      {isResendingVerification
                        ? 'Queueing verification...'
                        : 'Send verification email'}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleMarkVerifiedManually}
                      disabled={isMarkingVerified || isResendingVerification}
                    >
                      <CheckCircle2 />
                      {isMarkingVerified ? 'Marking verified...' : 'Mark verified manually'}
                    </Button>
                  </div>
                  <div className="mt-3">
                    <FeedbackMessage feedback={verificationFeedback} />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Case Ownership</CardTitle>
              <CardDescription>Current case owner and completion state.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Assigned owner" value={currentOwnerLabel} />
              <DetailItem
                label="Owner role"
                value={request.owner?.role ? titleize(request.owner.role) : 'Unassigned'}
              />
              <DetailItem
                label="Due badge"
                value={<DueDateBadge dueAt={request.dueAt} status={request.status} />}
              />
              <DetailItem
                label="Closed at"
                value={
                  request.closedAt === null
                    ? isClosed
                      ? 'Tracked in the activity log'
                      : 'Still open'
                    : formatDateTime(request.closedAt)
                }
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Owner</CardTitle>
              <CardDescription>Keep clear ownership on the request.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-3" onSubmit={handleAssignOwner}>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Owner
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={ownerValue}
                    onChange={(event) => setOwnerValue(event.target.value)}
                    disabled={isAssigningOwner}
                  >
                    <option value="unassigned">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name?.trim() || member.email?.trim() || 'Unnamed member'} (
                        {titleize(member.role)})
                      </option>
                    ))}
                  </select>
                </label>

                <Button type="submit" disabled={isAssigningOwner}>
                  <UserRoundCheck />
                  {isAssigningOwner ? 'Saving owner...' : 'Save owner'}
                </Button>
                <FeedbackMessage feedback={ownerFeedback} />
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update Status</CardTitle>
              <CardDescription>Move the request through active working states only.</CardDescription>
            </CardHeader>
            <CardContent>
              {isClosed ? (
                <p className="text-sm text-muted-foreground">
                  This request is already closed. Closed cases stay read-only in this workspace.
                </p>
              ) : availableStatusTransitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  There are no additional working-status transitions available from the current
                  state.
                </p>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={handleUpdateStatus}>
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Next status
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={statusValue}
                      onChange={(event) => setStatusValue(event.target.value)}
                      disabled={isUpdatingStatus}
                    >
                      {availableStatusTransitions.map((status) => (
                        <option key={status} value={status}>
                          {REQUEST_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Internal note for the activity log
                    <Textarea
                      placeholder="Optional context for the status change"
                      value={statusNote}
                      onChange={(event) => setStatusNote(event.target.value)}
                      className="min-h-24"
                      disabled={isUpdatingStatus}
                    />
                  </label>

                  <Button type="submit" disabled={isUpdatingStatus}>
                    <Clock3 />
                    {isUpdatingStatus ? 'Updating status...' : 'Update status'}
                  </Button>
                  <FeedbackMessage feedback={statusFeedback} />
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Close Request</CardTitle>
              <CardDescription>Finish the case with a bounded closure outcome.</CardDescription>
            </CardHeader>
            <CardContent>
              {isClosed ? (
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <p>This request has already been closed.</p>
                  <p>
                    Closed state:{' '}
                    <span className="font-medium text-foreground">
                      {REQUEST_STATUS_LABELS[request.status]}
                    </span>
                  </p>
                </div>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={handleCloseRequest}>
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Closure outcome
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={closeStatusValue}
                      onChange={(event) => setCloseStatusValue(event.target.value)}
                      disabled={isClosingRequest}
                    >
                      {availableCloseStatuses.map((status) => (
                        <option key={status} value={status}>
                          {REQUEST_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Closure note
                    <Textarea
                      placeholder="Optional context for why the request is closing"
                      value={closeNote}
                      onChange={(event) => setCloseNote(event.target.value)}
                      className="min-h-24"
                      disabled={isClosingRequest}
                    />
                  </label>

                  <Button
                    type="submit"
                    disabled={isClosingRequest}
                    variant={closeStatusValue === 'completed' ? 'default' : 'destructive'}
                  >
                    <CheckCircle2 />
                    {isClosingRequest ? 'Closing request...' : 'Close request'}
                  </Button>
                  <FeedbackMessage feedback={closeFeedback} />
                </form>
              )}
            </CardContent>
          </Card>

          <RequestEmailComposer workspaceId={workspaceId} requestId={request.id} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <RequestNotesPanel notes={notes} onCreateNote={handleCreateNote} />
        <RequestEmailLogList emailLogs={emailLogs} />
      </section>

      <RequestActivityTimeline events={events} />
    </div>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
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

function RequestDetailLoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="grid gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="grid gap-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-9 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-border/70 p-4">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-2 h-3 w-44" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function getVerificationSummary(status: VerificationStatus) {
  if (status === 'verified') {
    return 'Requester identity has been verified.'
  }

  if (status === 'pending') {
    return 'Waiting for the requester to complete verification.'
  }

  if (status === 'expired') {
    return 'The most recent verification attempt expired.'
  }

  if (status === 'failed') {
    return 'Verification needs a fresh follow-up.'
  }

  return 'Verification is not required for this request.'
}

function getDueDateAlert(dueAt: number | null, status: ActiveRequestStatus | ClosedRequestStatus) {
  if (dueAt === null || status === 'completed' || status === 'rejected' || status === 'cancelled') {
    return null
  }

  const timeUntilDue = dueAt - Date.now()

  if (timeUntilDue < 0) {
    return {
      tone: 'danger' as const,
      title: 'This request is overdue',
      description: `Target due date ${formatCalendarDate(
        dueAt
      )}. Review ownership, follow-up, and closure steps now.`,
    }
  }

  if (timeUntilDue < 24 * 60 * 60 * 1000) {
    return {
      tone: 'warning' as const,
      title: 'This request is due soon',
      description: `Target due date ${formatCalendarDate(
        dueAt
      )}. Keep the next requester or owner action moving today.`,
    }
  }

  return null
}

function titleize(value: string) {
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'We could not save that change. Refresh the request and try again.'
}
