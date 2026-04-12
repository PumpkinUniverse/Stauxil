'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import type { Id } from '@/convex/_generated/dataModel'
import { RequestsTable, type DashboardRequestRow } from '@/components/stauxil/requests-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const statusFilters = [
  { value: 'all', label: 'All requests' },
  { value: 'open', label: 'Open only' },
  { value: 'closed', label: 'Closed only' },
] as const

type RequestQueueBillingSnapshot = {
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

type RequestQueueSnapshot = {
  requests: DashboardRequestRow[]
}

export function RequestQueuePanel({
  workspaceId,
  workspaceName,
  publicFormPath,
  dashboard,
  billing,
  title,
  description,
  badgeLabel = 'Request queue',
}: {
  workspaceId: Id<'workspaces'>
  workspaceName: string
  publicFormPath?: string | null
  dashboard: RequestQueueSnapshot | undefined
  billing: RequestQueueBillingSnapshot | undefined
  title: string
  description: string
  badgeLabel?: string
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]['value']>('all')
  const deferredSearch = useDeferredValue(search)

  const filteredRequests = useMemo(() => {
    if (!dashboard) {
      return []
    }

    const searchValue = deferredSearch.trim().toLowerCase()

    return dashboard.requests.filter((request) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'open'
            ? !request.isClosed
            : request.isClosed

      if (!matchesStatus) {
        return false
      }

      if (!searchValue) {
        return true
      }

      const haystack = [
        request.caseId,
        request.title,
        request.requesterName,
        request.requesterEmail,
        request.type,
        request.status,
        request.verificationStatus,
        request.ownerName ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(searchValue)
    })
  }, [dashboard, deferredSearch, statusFilter])

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
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{badgeLabel}</Badge>
              <Badge variant="outline">{workspaceName}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:max-w-xl lg:items-end">
            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search case ID, requester, owner, or title"
                  className="pl-10"
                />
              </div>
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

            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    statusFilter === filter.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {billing ? (
            <div className="mb-4 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <p>
                Plan usage: {billing.usage.requestsThisMonth}
                {billing.usage.requestLimit === null ? '' : ` / ${billing.usage.requestLimit}`}{' '}
                requests this month on {billing.planLabel}.
              </p>
              {billing.features.exportsEnabled ? null : (
                <p className="mt-1">{billing.messages.exports}</p>
              )}
            </div>
          ) : null}

          <RequestsTable
            isLoading={dashboard === undefined}
            requests={filteredRequests}
            hasSourceRequests={(dashboard?.requests.length ?? 0) > 0}
            emptyStateActionHref={publicFormPath}
          />
        </CardContent>
      </Card>
    </div>
  )
}
