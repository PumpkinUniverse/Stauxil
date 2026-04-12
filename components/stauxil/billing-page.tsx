'use client'

import { PricingTable } from '@clerk/nextjs'
import { CheckCircle2, FileText, Palette, Users } from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useActiveWorkspace } from '@/components/stauxil/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function BillingPage() {
  const { workspaceId, workspaceName } = useActiveWorkspace()
  const billing = useQuery(api.workspaces.getBillingSnapshot, { workspaceId })

  if (billing === undefined) {
    return <BillingPageSkeleton />
  }

  const requestUsageLabel =
    billing.usage.requestLimit === null
      ? `${billing.usage.requestsThisMonth} this month`
      : `${billing.usage.requestsThisMonth} / ${billing.usage.requestLimit} this month`
  const memberUsageLabel =
    billing.usage.memberLimit === null
      ? `${billing.usage.members} members`
      : `${billing.usage.members} / ${billing.usage.memberLimit} members`

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Current workspace plan</Badge>
              <Badge variant="outline">{workspaceName}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle>{billing.planLabel}</CardTitle>
              <CardDescription>{billing.planDescription}</CardDescription>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {billing.recommendedUpgradeLabel
              ? `Upgrade path: ${billing.recommendedUpgradeLabel}`
              : 'Top plan active'}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <UsageCard
            title="Requests this month"
            value={requestUsageLabel}
            description={
              billing.limits.requestVolumeReached
                ? billing.messages.requestVolume ?? 'Request volume limit reached.'
                : 'Monthly request volume tracked against current plan.'
            }
            icon={FileText}
            tone={billing.limits.requestVolumeReached ? 'warning' : 'default'}
          />
          <UsageCard
            title="Team members"
            value={memberUsageLabel}
            description={
              billing.limits.memberLimitReached
                ? billing.messages.memberLimit ?? 'Member limit reached.'
                : 'Member cap tracked for the active workspace plan.'
            }
            icon={Users}
            tone={billing.limits.memberLimitReached ? 'warning' : 'default'}
          />
          <UsageCard
            title="Exports"
            value={billing.features.exportsEnabled ? 'Available' : 'Locked'}
            description={
              billing.features.exportsEnabled
                ? 'CSV exports and printable summaries are enabled.'
                : billing.messages.exports ?? 'Exports unlock on paid plans.'
            }
            icon={CheckCircle2}
            tone={billing.features.exportsEnabled ? 'success' : 'warning'}
          />
          <UsageCard
            title="Custom branding"
            value={billing.features.customBrandingEnabled ? 'Available' : 'Locked'}
            description={
              billing.features.customBrandingEnabled
                ? 'Logo and brand color controls are enabled.'
                : billing.messages.customBranding ?? 'Custom branding unlocks on paid plans.'
            }
            icon={Palette}
            tone={billing.features.customBrandingEnabled ? 'success' : 'warning'}
          />
        </CardContent>
      </Card>

      {billing.limits.requestVolumeReached || billing.limits.memberLimitReached ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">Workspace limit reached</p>
          {billing.limits.requestVolumeReached ? (
            <p className="mt-2">{billing.messages.requestVolume}</p>
          ) : null}
          {billing.limits.memberLimitReached ? (
            <p className={billing.limits.requestVolumeReached ? 'mt-2' : 'mt-2'}>
              {billing.messages.memberLimit}
            </p>
          ) : null}
        </div>
      ) : null}

      <Card id="pricing-table">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Hosted pricing</Badge>
            <Badge variant="outline">Clerk billing</Badge>
          </div>
          <CardTitle>Upgrade or review available plans</CardTitle>
          <CardDescription>
            Hosted pricing stays in Clerk. Stauxil reads the active plan and enforces current
            workspace limits inside the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border/70 bg-background p-2">
            <PricingTable />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function UsageCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  description: string
  icon: typeof FileText
  tone: 'default' | 'success' | 'warning'
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div
          className={[
            'flex size-11 shrink-0 items-center justify-center rounded-2xl',
            tone === 'default' ? 'bg-primary/10 text-primary' : '',
            tone === 'success' ? 'bg-emerald-500/10 text-emerald-700' : '',
            tone === 'warning' ? 'bg-amber-500/10 text-amber-700' : '',
          ].join(' ')}
        >
          <Icon />
        </div>
      </div>
    </div>
  )
}

function BillingPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-border/70 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-7 w-32" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full rounded-3xl" />
        </CardContent>
      </Card>
    </div>
  )
}
