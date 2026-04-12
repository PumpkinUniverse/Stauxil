import type { ReactNode } from 'react'
import { fetchMutation, fetchQuery } from 'convex/nextjs'
import { StauxilAppShell } from '@/components/stauxil/app-shell'
import { api } from '@/convex/_generated/api'
import { normalizeWorkspacePlan } from '@/lib/stauxil/billing'
import { resolveWorkspacePlanFromClerk } from '@/lib/stauxil/clerk-billing'
import { getConvexServerAuth } from '@/lib/stauxil/server-auth'

export default async function AppLayout({ children }: { children: ReactNode }) {
  await syncActiveWorkspacePlan()
  return <StauxilAppShell>{children}</StauxilAppShell>
}

async function syncActiveWorkspacePlan() {
  try {
    const { clerkAuth, token } = await getConvexServerAuth()

    if (!clerkAuth.userId || !token) {
      return
    }

    const workspaces = await fetchQuery(api.workspaces.listForCurrentUser, {}, { token })
    const activeWorkspace = workspaces[0]

    if (!activeWorkspace || activeWorkspace.membership.role !== 'owner') {
      return
    }

    const nextPlan = await resolveWorkspacePlanFromClerk(clerkAuth.userId)
    const currentPlan = normalizeWorkspacePlan(activeWorkspace.workspace.plan)

    if (currentPlan === nextPlan) {
      return
    }

    await fetchMutation(
      api.workspaces.syncPlan,
      {
        workspaceId: activeWorkspace.workspace._id,
        plan: nextPlan,
      },
      { token }
    )
  } catch {
    // Billing sync should not block the app shell if Clerk billing is unavailable.
  }
}
