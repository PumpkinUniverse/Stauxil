import 'server-only'

import { clerkClient } from '@clerk/nextjs/server'
import { getHighestWorkspacePlan, type WorkspacePlan } from '@/lib/stauxil/billing'

export async function resolveWorkspacePlanFromClerk(
  userId: string
): Promise<WorkspacePlan | null> {
  try {
    const client = await clerkClient()
    const subscription = await client.billing.getUserBillingSubscription(userId)

    const planCandidates = subscription.subscriptionItems.flatMap((item) =>
      [item.plan?.slug, item.plan?.name].flatMap((value) =>
        value ? [mapClerkPlanNameToWorkspacePlan(value)] : []
      )
    )

    return getHighestWorkspacePlan(planCandidates)
  } catch {
    return null
  }
}

function mapClerkPlanNameToWorkspacePlan(value: string): WorkspacePlan | null {
  const normalizedValue = value.trim().toLowerCase()

  if (!normalizedValue) {
    return null
  }

  if (
    normalizedValue.includes('team') ||
    normalizedValue.includes('business') ||
    normalizedValue.includes('enterprise')
  ) {
    return 'team'
  }

  if (normalizedValue.includes('pro') || normalizedValue.includes('professional')) {
    return 'pro'
  }

  if (
    normalizedValue.includes('starter') ||
    normalizedValue.includes('basic') ||
    normalizedValue.includes('free')
  ) {
    return 'starter'
  }

  return null
}
