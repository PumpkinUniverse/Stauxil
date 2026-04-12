'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import { usePaginatedQuery, useQuery } from 'convex/react'
import { Download, Search } from 'lucide-react'
import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import { useActiveWorkspace } from '@/components/stauxil/app-shell'
import { RequestsTable } from '@/components/stauxil/requests-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_VALUES,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_VALUES,
  type RequestStatus,
  type RequestType,
} from '@/lib/stauxil/constants'
import { cn } from '@/lib/utils'

type OwnerFilterValue = 'all' | 'unassigned' | Id<'workspaceMembers'>

type RequestInboxBillingSnapshot = {
  planLabel: string
  usage: {
    requestsThisMonth: number
    requestLimit: number | null
  }
  features: {
    exportsEnabled: boolean
  }
  limits: {
    requestVolumeReached: boolean
  }
  messages: {
    exports: string | null
    requestVolume: string | null
  }
}

export function RequestsPage() {
  const { workspaceId, workspaceName, publicFormPath } = useActiveWorkspace()
  const billing = useQuery(api.workspaces.getBillingSnapshot, {
    workspaceId,
  }) as RequestInboxBillingSnapshot | undefined
  const metadata = useQuery(api.requests.getInboxMetadata, {
    workspaceId,
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all')
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilterValue>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | RequestType>('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const deferredSearch = useDeferredValue(search)

  const paginatedArgs = useMemo(
    () => ({
      workspaceId,
      search: deferredSearch.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      assignedMemberId:
        ownerFilter === 'all' ? undefined : ownerFilter === 'unassigned' ? null : ownerFilter,
      requestType: typeFilter === 'all' ? undefined : typeFilter,
      overdueOnly,
    }),
    [deferredSearch, overdueOnly, ownerFilter, statusFilter, typeFilter, workspaceId]
  )

  const inbox = usePaginatedQuery(api.requests.listInboxPage, paginatedArgs, {
    initialNumItems: 20,
  })

  const activeFilters = [
    statusFilter !== 'all' ? `Status: ${REQUEST_STATUS_LABELS[statusFilter]}` : null,
    ownerFilter === 'unassigned'
      ? 'Owner: Unassigned'
      : ownerFilter !== 'all'
        ? `Owner: ${getOwnerLabel(metadata?.owners, ownerFilter)}`
        : null,
    typeFilter !== 'all' ? `Type: ${REQUEST_TYPE_LABELS[typeFilter]}` : null,
    overdueOnly ? 'Overdue only' : null,
    deferredSearch.trim() ? `Search: ${deferredSearch.trim()}` : null,
  ].filter((value): value is string => value !== null)

  const hasActiveFilters = activeFilters.length > 0
  const loadedCount = inbox.results.length
  const hasSourceRequests = (metadata?.summary.totalRequests ?? 0) > 0

  return (
    <div className="flex flex-col gap-6">
      {billing?.limits.requestVolumeReached ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">Monthly request limit reached</p>
          <p className="mt-2">{billing.messages.requestVolume}</p>
          <p className="mt-2">
            Public intake is paused for new requests until the workspace plan is updated.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Scalable inbox</Badge>
                <Badge variant="outline">{workspaceName}</Badge>
                {metadata ? (
                  <>
                    <Badge variant="outline">{metadata.summary.totalRequests} total</Badge>
                    <Badge variant="outline">{metadata.summary.openRequests} open</Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        metadata.summary.overdueRequests > 0 &&
                          'border-rose-300 bg-rose-500/10 text-rose-700'
                      )}
                    >
                      {metadata.summary.overdueRequests} overdue
                    </Badge>
                  </>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                <CardTitle>Request queue</CardTitle>
                <CardDescription>
                  Work through the full workspace inbox with server-backed pagination, workspace
                  filters, and direct access to each case record.
                </CardDescription>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 lg:max-w-xs lg:items-end">
              {billing === undefined ? (
                <Button variant="outline" size="sm" disabled>
                  <Download data-icon="inline-start" />
                  Checking exports...
                </Button>
              ) : billing.features.exportsEnabled === false ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/billing">
                    <Download data-icon="inline-start" />
                    Upgrade to export
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/exports/requests?workspaceId=${encodeURIComponent(workspaceId)}`}>
                    <Download data-icon="inline-start" />
                    Export CSV
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,0.8fr))_auto] lg:items-end">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search case ID or requester email"
                className="pl-10"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | RequestStatus)}
                className={selectClassName}
              >
                <option value="all">All statuses</option>
                {REQUEST_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {REQUEST_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Owner
              </span>
              <select
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value as OwnerFilterValue)}
                className={selectClassName}
                disabled={metadata === undefined}
              >
                <option value="all">All owners</option>
                <option value="unassigned">Unassigned</option>
                {metadata?.owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name ?? owner.email ?? 'Unknown member'}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Type
              </span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as 'all' | RequestType)}
                className={selectClassName}
              >
                <option value="all">All types</option>
                {REQUEST_TYPE_VALUES.map((requestType) => (
                  <option key={requestType} value={requestType}>
                    {REQUEST_TYPE_LABELS[requestType]}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setOverdueOnly((current) => !current)}
                className={cn(
                  'inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors',
                  overdueOnly
                    ? 'border-rose-300 bg-rose-500/10 text-rose-700'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                Overdue only
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {billing ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <p>
                Plan usage: {billing.usage.requestsThisMonth}
                {billing.usage.requestLimit === null ? '' : ` / ${billing.usage.requestLimit}`}{' '}
                requests this month on {billing.planLabel}.
              </p>
              {billing.features.exportsEnabled ? null : <p className="mt-1">{billing.messages.exports}</p>}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {hasActiveFilters
                  ? `Showing ${loadedCount} matching request${loadedCount === 1 ? '' : 's'}`
                  : metadata
                    ? `Showing ${loadedCount} of ${metadata.summary.totalRequests} request${metadata.summary.totalRequests === 1 ? '' : 's'}`
                    : `Showing ${loadedCount} request${loadedCount === 1 ? '' : 's'}`}
              </span>
              <span aria-hidden="true">|</span>
              <span>{getPaginationFeedback(inbox.status)}</span>
            </div>

            {activeFilters.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <Badge key={filter} variant="outline">
                    {filter}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <RequestsTable
            isLoading={inbox.status === 'LoadingFirstPage'}
            requests={inbox.results}
            hasSourceRequests={hasSourceRequests}
            emptyStateActionHref={publicFormPath}
          />

          {inbox.status === 'CanLoadMore' || inbox.status === 'LoadingMore' ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => inbox.loadMore(20)}
                disabled={inbox.status === 'LoadingMore'}
              >
                {inbox.status === 'LoadingMore' ? 'Loading more...' : 'Load more requests'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function getOwnerLabel(
  owners:
    | Array<{
        id: Id<'workspaceMembers'>
        name: string | null
        email: string | null
      }>
    | undefined,
  ownerId: Id<'workspaceMembers'>
) {
  const owner = owners?.find((entry) => entry.id === ownerId)
  return owner?.name ?? owner?.email ?? 'Selected owner'
}

function getPaginationFeedback(
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'
) {
  if (status === 'LoadingFirstPage') {
    return 'Loading the request queue...'
  }

  if (status === 'LoadingMore') {
    return 'Loading the next page from the server...'
  }

  if (status === 'CanLoadMore') {
    return 'More requests are available.'
  }

  return 'You have reached the end of the current result set.'
}

const selectClassName =
  'h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
