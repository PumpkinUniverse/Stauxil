import Link from 'next/link'
import {
  DueDateBadge,
  RequestStatusBadge,
  VerificationStatusBadge,
  formatRequestTypeLabel,
} from '@/components/stauxil/request-badges'
import { CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RequestStatus, RequestType, VerificationStatus } from '@/lib/stauxil/constants'

export type DashboardRequestRow = {
  id: string
  caseId: string
  title: string
  requesterName: string
  requesterEmail: string
  type: RequestType
  status: RequestStatus
  verificationStatus: VerificationStatus
  ownerName: string | null
  dueAt: number | null
  isClosed: boolean
  lastEventAt?: number
}

export function RequestsTable({
  isLoading,
  requests,
  hasSourceRequests,
  emptyStateActionHref = null,
}: {
  isLoading: boolean
  requests: DashboardRequestRow[]
  hasSourceRequests: boolean
  emptyStateActionHref?: string | null
}) {
  if (isLoading) {
    return <RequestsTableLoadingState />
  }

  if (!hasSourceRequests) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
        <h3 className="text-lg font-semibold">No requests yet</h3>
        <CardDescription>
          New request submissions will appear here with status, verification, owner, due-date
          warnings, and audit trail activity once this workspace starts receiving them.
        </CardDescription>
        <CardDescription>
          Share the public intake page to start the workflow and route new requests into this
          queue.
        </CardDescription>
        {emptyStateActionHref ? (
          <Button asChild variant="outline" className="mx-auto mt-2">
            <Link href={emptyStateActionHref} target="_blank" rel="noreferrer">
              Open public intake page
            </Link>
          </Button>
        ) : null}
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
        <h3 className="text-lg font-semibold">No matching requests</h3>
        <CardDescription>
          Adjust the current search or status filter to see more of the request queue.
        </CardDescription>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case ID</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Verification</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Due date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="align-top">
                <div className="flex min-w-32 flex-col gap-1">
                  <Link
                    href={`/requests/${encodeURIComponent(request.caseId)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {request.caseId}
                  </Link>
                  <span className="text-xs text-muted-foreground">{request.title}</span>
                </div>
              </TableCell>
              <TableCell className="align-top">
                <div className="flex min-w-40 flex-col gap-1">
                  <span className="font-medium">{request.requesterName}</span>
                  <span className="text-xs text-muted-foreground">{request.requesterEmail}</span>
                </div>
              </TableCell>
              <TableCell className="align-top">
                <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium">
                  {formatRequestTypeLabel(request.type)}
                </span>
              </TableCell>
              <TableCell className="align-top">
                <RequestStatusBadge status={request.status} />
              </TableCell>
              <TableCell className="align-top">
                <VerificationStatusBadge status={request.verificationStatus} />
              </TableCell>
              <TableCell className="align-top">
                <span className={cn(!request.ownerName && 'text-muted-foreground')}>
                  {request.ownerName ?? 'Unassigned'}
                </span>
              </TableCell>
              <TableCell className="align-top">
                <DueDateBadge dueAt={request.dueAt} status={request.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RequestsTableLoadingState() {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case ID</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Verification</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Due date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-28 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
