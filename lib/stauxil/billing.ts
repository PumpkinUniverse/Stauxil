export const WORKSPACE_PLAN_VALUES = ['starter', 'pro', 'team'] as const

export type WorkspacePlan = (typeof WORKSPACE_PLAN_VALUES)[number]

export type WorkspacePlanDefinition = {
  label: string
  description: string
  requestVolumeLimit: number | null
  memberLimit: number | null
  exportsEnabled: boolean
  customBrandingEnabled: boolean
}

export const DEFAULT_WORKSPACE_PLAN: WorkspacePlan = 'starter'

export const DEFAULT_STAUXIL_BRAND_COLOR = '#537dc4'

export const WORKSPACE_PLAN_DEFINITIONS: Record<WorkspacePlan, WorkspacePlanDefinition> = {
  starter: {
    label: 'Starter',
    description: 'Low-friction entry tier for very small teams.',
    requestVolumeLimit: 20,
    memberLimit: 1,
    exportsEnabled: false,
    customBrandingEnabled: false,
  },
  pro: {
    label: 'Pro',
    description: 'Best default paid tier for small companies.',
    requestVolumeLimit: 100,
    memberLimit: 5,
    exportsEnabled: true,
    customBrandingEnabled: true,
  },
  team: {
    label: 'Team',
    description: 'Higher-usage workspace with more operational control.',
    requestVolumeLimit: null,
    memberLimit: null,
    exportsEnabled: true,
    customBrandingEnabled: true,
  },
}

const PLAN_RANK: Record<WorkspacePlan, number> = {
  starter: 0,
  pro: 1,
  team: 2,
}

export function normalizeWorkspacePlan(value: string | null | undefined): WorkspacePlan {
  if (value === 'pro' || value === 'team' || value === 'starter') {
    return value
  }

  return DEFAULT_WORKSPACE_PLAN
}

export function getWorkspacePlanDefinition(
  plan: WorkspacePlan | string | null | undefined
): WorkspacePlanDefinition {
  return WORKSPACE_PLAN_DEFINITIONS[normalizeWorkspacePlan(plan)]
}

export function getUpgradePlan(plan: WorkspacePlan | string | null | undefined): WorkspacePlan | null {
  const normalizedPlan = normalizeWorkspacePlan(plan)

  if (normalizedPlan === 'starter') {
    return 'pro'
  }

  if (normalizedPlan === 'pro') {
    return 'team'
  }

  return null
}

export function compareWorkspacePlans(left: WorkspacePlan, right: WorkspacePlan) {
  return PLAN_RANK[left] - PLAN_RANK[right]
}

export function getHighestWorkspacePlan(plans: Array<WorkspacePlan | null | undefined>) {
  return plans
    .filter((plan): plan is WorkspacePlan => plan !== null && plan !== undefined)
    .sort((left, right) => compareWorkspacePlans(right, left))[0] ?? DEFAULT_WORKSPACE_PLAN
}

export function getRequestVolumeUpgradeMessage(
  plan: WorkspacePlan | string | null | undefined
) {
  const currentPlan = normalizeWorkspacePlan(plan)
  const currentDefinition = getWorkspacePlanDefinition(currentPlan)
  const upgradePlan = getUpgradePlan(currentPlan)

  if (currentDefinition.requestVolumeLimit === null || upgradePlan === null) {
    return null
  }

  const upgradeDefinition = getWorkspacePlanDefinition(upgradePlan)
  const upgradeLimitText =
    upgradeDefinition.requestVolumeLimit === null
      ? 'remove the monthly request cap'
      : `raise the limit to ${upgradeDefinition.requestVolumeLimit} requests per month`

  return `${currentDefinition.label} includes ${currentDefinition.requestVolumeLimit} requests per month. Upgrade to ${upgradeDefinition.label} to ${upgradeLimitText}.`
}

export function getMemberLimitUpgradeMessage(
  plan: WorkspacePlan | string | null | undefined
) {
  const currentPlan = normalizeWorkspacePlan(plan)
  const currentDefinition = getWorkspacePlanDefinition(currentPlan)
  const upgradePlan = getUpgradePlan(currentPlan)

  if (currentDefinition.memberLimit === null || upgradePlan === null) {
    return null
  }

  const upgradeDefinition = getWorkspacePlanDefinition(upgradePlan)
  const currentLimitLabel =
    currentDefinition.memberLimit === 1
      ? '1 member'
      : `${currentDefinition.memberLimit} members`
  const upgradeLimitLabel =
    upgradeDefinition.memberLimit === null
      ? 'remove the member cap'
      : `raise the limit to ${upgradeDefinition.memberLimit} members`

  return `${currentDefinition.label} supports ${currentLimitLabel}. Upgrade to ${upgradeDefinition.label} to ${upgradeLimitLabel}.`
}

export function getExportsUpgradeMessage(plan: WorkspacePlan | string | null | undefined) {
  const currentPlan = normalizeWorkspacePlan(plan)
  const currentDefinition = getWorkspacePlanDefinition(currentPlan)
  const upgradePlan = getUpgradePlan(currentPlan)

  if (currentDefinition.exportsEnabled || upgradePlan === null) {
    return null
  }

  const upgradeDefinition = getWorkspacePlanDefinition(upgradePlan)
  return `Upgrade to ${upgradeDefinition.label} to export request data and printable summaries.`
}

export function getCustomBrandingUpgradeMessage(
  plan: WorkspacePlan | string | null | undefined
) {
  const currentPlan = normalizeWorkspacePlan(plan)
  const currentDefinition = getWorkspacePlanDefinition(currentPlan)
  const upgradePlan = getUpgradePlan(currentPlan)

  if (currentDefinition.customBrandingEnabled || upgradePlan === null) {
    return null
  }

  const upgradeDefinition = getWorkspacePlanDefinition(upgradePlan)
  return `Upgrade to ${upgradeDefinition.label} to unlock custom logo and brand color controls.`
}
