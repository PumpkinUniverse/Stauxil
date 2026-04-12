import { PricingTable } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WORKSPACE_PLAN_DEFINITIONS, WORKSPACE_PLAN_VALUES } from '@/lib/stauxil/billing'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Review Stauxil workspace plans, usage limits, exports, and branding controls.',
}

export default function PricingPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Stauxil pricing</Badge>
            <Badge variant="outline">Hosted by Clerk</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <CardTitle>Plans for privacy request operations</CardTitle>
            <CardDescription>
              Pick the workspace capacity you need. Current plan controls focus on monthly request
              volume, member count, exports, and custom branding.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {WORKSPACE_PLAN_VALUES.map((plan) => {
            const definition = WORKSPACE_PLAN_DEFINITIONS[plan]

            return (
              <div
                key={plan}
                className="rounded-3xl border border-border/70 bg-background p-5"
              >
                <p className="text-lg font-semibold">{definition.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">{definition.description}</p>
                <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  <p>
                    Requests:{' '}
                    <span className="font-medium text-foreground">
                      {definition.requestVolumeLimit === null
                        ? 'Unlimited'
                        : `${definition.requestVolumeLimit} / month`}
                    </span>
                  </p>
                  <p>
                    Members:{' '}
                    <span className="font-medium text-foreground">
                      {definition.memberLimit === null ? 'Unlimited' : definition.memberLimit}
                    </span>
                  </p>
                  <p>
                    Exports:{' '}
                    <span className="font-medium text-foreground">
                      {definition.exportsEnabled ? 'Included' : 'Not included'}
                    </span>
                  </p>
                  <p>
                    Custom branding:{' '}
                    <span className="font-medium text-foreground">
                      {definition.customBrandingEnabled ? 'Included' : 'Default only'}
                    </span>
                  </p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-background p-2">
        <PricingTable />
      </div>
    </div>
  )
}
