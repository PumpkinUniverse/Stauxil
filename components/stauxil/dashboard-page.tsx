'use client'

import { useQuery } from 'convex/react'
import { AlertTriangle, CheckCheck, Clock3, ShieldAlert } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { useActiveWorkspace } from '@/components/stauxil/app-shell'
import { RequestQueuePanel } from '@/components/stauxil/request-queue-panel'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { workspaceId, workspaceName, publicFormPath } = useActiveWorkspace()
  const dashboard = useQuery(api.requests.dashboardSnapshot, {
    workspaceId,
    limit: 12,
  })
  const billing = useQuery(api.workspaces.getBillingSnapshot, {
    workspaceId,
  })

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard === undefined ? (
          Array.from({ length: 4 }).map((_, index) => <SummaryCardSkeleton key={index} />)
        ) : (
          <>
            <SummaryCard
              title="Open requests"
              value={dashboard.summary.openRequests}
              description="Active requests still in motion"
              icon={Clock3}
            />
            <SummaryCard
              title="Overdue requests"
              value={dashboard.summary.overdueRequests}
              description="Past due and still unresolved"
              icon={ShieldAlert}
              tone="warning"
            />
            <SummaryCard
              title="Due this week"
              value={dashboard.summary.dueThisWeek}
              description="Due within the next 7 days"
              icon={AlertTriangle}
            />
            <SummaryCard
              title="Fulfilled this month"
              value={dashboard.summary.fulfilledThisMonth}
              description="Completed during the current month"
              icon={CheckCheck}
              tone="success"
            />
          </>
        )}
      </section>

      <RequestQueuePanel
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        publicFormPath={publicFormPath}
        dashboard={dashboard}
        billing={billing}
        badgeLabel="Recent requests"
        title="Request queue"
        description="Review recent requests, filter the queue, and open a case for status updates, notes, and email activity."
      />
    </div>
  )
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'default',
}: {
  title: string
  value: number
  description: string
  icon: typeof Clock3
  tone?: 'default' | 'warning' | 'success'
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-2xl',
            tone === 'warning' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
            tone === 'success' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            tone === 'default' && 'bg-primary/10 text-primary'
          )}
        >
          <Icon />
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  )
}
