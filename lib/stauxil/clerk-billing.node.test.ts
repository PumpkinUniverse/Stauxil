import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUserBillingSubscription, clerkClient } = vi.hoisted(() => {
  const getUserBillingSubscription = vi.fn()
  const clerkClient = vi.fn(async () => ({
    billing: {
      getUserBillingSubscription,
    },
  }))

  return { getUserBillingSubscription, clerkClient }
})

vi.mock('server-only', () => ({}))

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient,
}))

import { resolveWorkspacePlanFromClerk } from '@/lib/stauxil/clerk-billing'
import { getWorkspacePlanUpdate } from '@/lib/stauxil/workspace-plan-sync'

describe('resolveWorkspacePlanFromClerk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['starter', 'starter'],
    ['pro', 'pro'],
    ['team', 'team'],
  ] as const)('maps explicit %s plans correctly', async (planName, expectedPlan) => {
    getUserBillingSubscription.mockResolvedValue({
      subscriptionItems: [{ plan: { slug: planName } }],
    })

    await expect(resolveWorkspacePlanFromClerk('user_123')).resolves.toBe(expectedPlan)
  })

  it('returns the highest mapped plan across subscription items', async () => {
    getUserBillingSubscription.mockResolvedValue({
      subscriptionItems: [
        { plan: { slug: 'starter' } },
        { plan: { name: 'Professional' } },
        { plan: { name: 'Enterprise' } },
      ],
    })

    await expect(resolveWorkspacePlanFromClerk('user_123')).resolves.toBe('team')
  })

  it('returns null when Clerk billing cannot be read', async () => {
    getUserBillingSubscription.mockRejectedValue(new Error('temporary outage'))

    await expect(resolveWorkspacePlanFromClerk('user_123')).resolves.toBeNull()
  })
})

describe('getWorkspacePlanUpdate', () => {
  it('does not downgrade when the resolved plan is unknown', () => {
    expect(getWorkspacePlanUpdate('team', null)).toBeNull()
  })

  it('returns null when the resolved plan is unchanged', () => {
    expect(getWorkspacePlanUpdate('pro', 'pro')).toBeNull()
  })

  it('returns the next plan when a real plan change exists', () => {
    expect(getWorkspacePlanUpdate('starter', 'pro')).toBe('pro')
  })
})
