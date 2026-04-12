import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  DEFAULT_STAUXIL_BRAND_COLOR,
  getCustomBrandingUpgradeMessage,
  getExportsUpgradeMessage,
  getMemberLimitUpgradeMessage,
  getRequestVolumeUpgradeMessage,
  getUpgradePlan,
  getWorkspacePlanDefinition,
  normalizeWorkspacePlan,
} from '../../lib/stauxil/billing'

type BillingCtx = QueryCtx | MutationCtx

export async function countWorkspaceMembers(
  ctx: BillingCtx,
  workspaceId: Id<'workspaces'>
) {
  let memberCount = 0

  for await (const member of ctx.db
    .query('workspaceMembers')
    .withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId))) {
    memberCount += member._id ? 1 : 0
  }

  return memberCount
}

export async function countWorkspaceRequestsThisMonth(
  ctx: BillingCtx,
  workspaceId: Id<'workspaces'>,
  now = Date.now()
) {
  let requestCount = 0
  const startOfMonth = getStartOfCurrentUtcMonth(now)

  for await (const request of ctx.db
    .query('requests')
    .withIndex('by_workspace_id_and_submitted_at', (q) =>
      q.eq('workspaceId', workspaceId).gte('submittedAt', startOfMonth)
    )
    .order('desc')) {
    if (request.archivedAt === null) {
      requestCount += 1
    }
  }

  return requestCount
}

export async function getWorkspaceBillingSnapshot(
  ctx: BillingCtx,
  workspace: Pick<Doc<'workspaces'>, '_id' | 'plan'>
) {
  const plan = normalizeWorkspacePlan(workspace.plan)
  const planDefinition = getWorkspacePlanDefinition(plan)
  const requestCountThisMonth = await countWorkspaceRequestsThisMonth(ctx, workspace._id)
  const memberCount = await countWorkspaceMembers(ctx, workspace._id)
  const recommendedUpgradePlan = getUpgradePlan(plan)
  const recommendedUpgradeLabel =
    recommendedUpgradePlan === null
      ? null
      : getWorkspacePlanDefinition(recommendedUpgradePlan).label
  const requestVolumeReached =
    planDefinition.requestVolumeLimit !== null &&
    requestCountThisMonth >= planDefinition.requestVolumeLimit
  const memberLimitReached =
    planDefinition.memberLimit !== null && memberCount >= planDefinition.memberLimit

  return {
    plan,
    planLabel: planDefinition.label,
    planDescription: planDefinition.description,
    recommendedUpgradePlan,
    recommendedUpgradeLabel,
    usage: {
      requestsThisMonth: requestCountThisMonth,
      requestLimit: planDefinition.requestVolumeLimit,
      remainingRequests:
        planDefinition.requestVolumeLimit === null
          ? null
          : Math.max(0, planDefinition.requestVolumeLimit - requestCountThisMonth),
      members: memberCount,
      memberLimit: planDefinition.memberLimit,
    },
    features: {
      exportsEnabled: planDefinition.exportsEnabled,
      customBrandingEnabled: planDefinition.customBrandingEnabled,
    },
    limits: {
      requestVolumeReached,
      memberLimitReached,
    },
    messages: {
      requestVolume: getRequestVolumeUpgradeMessage(plan),
      memberLimit: getMemberLimitUpgradeMessage(plan),
      exports: getExportsUpgradeMessage(plan),
      customBranding: getCustomBrandingUpgradeMessage(plan),
    },
  }
}

export async function assertWorkspaceCanCreateRequest(
  ctx: BillingCtx,
  workspace: Pick<Doc<'workspaces'>, '_id' | 'plan'>
) {
  const billing = await getWorkspaceBillingSnapshot(ctx, workspace)

  if (billing.limits.requestVolumeReached) {
    throw new Error(
      billing.messages.requestVolume ?? 'Upgrade your workspace plan to create more requests.'
    )
  }

  return billing
}

export async function assertWorkspaceCanExport(
  ctx: BillingCtx,
  workspace: Pick<Doc<'workspaces'>, '_id' | 'plan'>
) {
  const billing = await getWorkspaceBillingSnapshot(ctx, workspace)

  if (!billing.features.exportsEnabled) {
    throw new Error(
      billing.messages.exports ?? 'Upgrade your workspace plan to export request data.'
    )
  }

  return billing
}

export function assertWorkspaceCanUseCustomBranding(input: {
  workspace: Pick<Doc<'workspaces'>, 'plan'>
  brandColor: string
  logoUrl: string | null
}) {
  const planDefinition = getWorkspacePlanDefinition(input.workspace.plan)

  if (planDefinition.customBrandingEnabled) {
    return
  }

  const usesCustomBrandColor =
    input.brandColor.trim().toLowerCase() !== DEFAULT_STAUXIL_BRAND_COLOR
  const usesCustomLogo = input.logoUrl !== null

  if (usesCustomBrandColor || usesCustomLogo) {
    throw new Error(
      getCustomBrandingUpgradeMessage(input.workspace.plan) ??
        'Upgrade your workspace plan to change branding.'
    )
  }
}

export function getStartOfCurrentUtcMonth(timestamp: number) {
  const date = new Date(timestamp)
  date.setUTCDate(1)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime()
}
