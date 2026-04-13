import type { WorkspacePlan } from '@/lib/stauxil/billing'

export function getWorkspacePlanUpdate(
  currentPlan: WorkspacePlan,
  resolvedPlan: WorkspacePlan | null
) {
  if (resolvedPlan === null || currentPlan === resolvedPlan) {
    return null
  }

  return resolvedPlan
}
