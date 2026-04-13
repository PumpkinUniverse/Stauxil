import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { ensureDefaultEmailTemplates } from './emailTemplates'
import { assertWorkspaceCanUseCustomBranding, getWorkspaceBillingSnapshot } from './lib/billing'
import { getDefaultWorkspaceName, normalizeEmail, requireIdentity, requireWorkspaceAccess } from './lib/access'
import { requestTypeValidator, workspacePlanValidator } from './validators'
import {
  DEFAULT_STAUXIL_BRAND_COLOR,
  DEFAULT_WORKSPACE_PLAN,
  getWorkspacePlanDefinition,
} from '../lib/stauxil/billing'

const DEFAULT_WORKSPACE_SLA_DAYS = 30
const DEFAULT_WORKSPACE_TIMEZONE = 'UTC'
const DEFAULT_WORKSPACE_BRAND_COLOR = DEFAULT_STAUXIL_BRAND_COLOR
const DEFAULT_PUBLIC_REQUEST_STATUS = 'received' as const
const DEFAULT_PUBLIC_REQUEST_TYPES = [
  'access',
  'deletion',
  'correction',
  'portability',
  'objection',
  'restriction',
] as const
const MAX_WORKSPACE_NAME_LENGTH = 80
const MAX_SUPPORT_EMAIL_LENGTH = 254
const MAX_LOGO_URL_LENGTH = 500
const MAX_PUBLIC_INTAKE_INTRO_LENGTH = 600
const MAX_PUBLIC_INTAKE_SUCCESS_MESSAGE_LENGTH = 240
const BRAND_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

type WorkspaceLookupCtx = MutationCtx | QueryCtx
type WorkspaceMembershipEntry = {
  membership: Doc<'workspaceMembers'>
  workspace: Doc<'workspaces'>
}

export async function findWorkspaceBySlug(
  ctx: WorkspaceLookupCtx,
  workspaceSlug: string
): Promise<Doc<'workspaces'> | null> {
  const normalizedSlug = normalizeWorkspaceSlug(workspaceSlug)

  if (!normalizedSlug) {
    return null
  }

  const workspace = await ctx.db
    .query('workspaces')
    .withIndex('by_slug', (q) => q.eq('slug', normalizedSlug))
    .unique()

  if (workspace === null || workspace.archivedAt !== null) {
    return null
  }

  return workspace
}

export function normalizeWorkspaceSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function getWorkspaceSlug(workspace: Doc<'workspaces'>): string | null {
  const slug = workspace.slug?.trim() || ''
  return slug || null
}

function buildPublicFormPath(workspace: Doc<'workspaces'>) {
  const workspaceSlug = getWorkspaceSlug(workspace)
  if (workspaceSlug === null || !isPublicIntakeConfigured(workspace)) {
    return null
  }

  return `/request/${workspaceSlug}`
}

function getAllowedPublicRequestTypes(workspace: Doc<'workspaces'>): Doc<'requests'>['requestType'][] {
  if (
    workspace.allowedPublicRequestTypes !== undefined &&
    workspace.allowedPublicRequestTypes.length > 0
  ) {
    return workspace.allowedPublicRequestTypes
  }

  return [...DEFAULT_PUBLIC_REQUEST_TYPES]
}

function getWorkspaceSupportEmail(
  workspace: Doc<'workspaces'>,
  options?: { publicValue?: boolean }
): string | null {
  const supportEmail = workspace.supportEmail?.trim()

  if (supportEmail) {
    return supportEmail
  }

  if (options?.publicValue) {
    return null
  }

  return workspace.createdByEmail?.trim() || null
}

export function isPublicIntakeConfigured(workspace: Doc<'workspaces'>) {
  return getWorkspaceSupportEmail(workspace, { publicValue: true }) !== null
}

export function getPublicIntakeBlockerMessage(workspace: Doc<'workspaces'>) {
  if (!isPublicIntakeConfigured(workspace)) {
    return 'Public request intake is blocked until a support email is added in workspace settings.'
  }

  return null
}

function getWorkspaceTimezone(workspace: Doc<'workspaces'>) {
  const timezone = workspace.timezone?.trim()
  return timezone || DEFAULT_WORKSPACE_TIMEZONE
}

function getWorkspaceBrandColor(workspace: Doc<'workspaces'>) {
  if (!getWorkspacePlanDefinition(workspace.plan).customBrandingEnabled) {
    return DEFAULT_WORKSPACE_BRAND_COLOR
  }

  const brandColor = workspace.brandColor?.trim()

  if (!brandColor || !BRAND_COLOR_PATTERN.test(brandColor)) {
    return DEFAULT_WORKSPACE_BRAND_COLOR
  }

  return brandColor.toLowerCase()
}

function getWorkspaceLogoUrl(workspace: Doc<'workspaces'>) {
  if (!getWorkspacePlanDefinition(workspace.plan).customBrandingEnabled) {
    return null
  }

  const logoUrl = workspace.logoUrl?.trim()
  return logoUrl || null
}

function normalizeWorkspaceName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ')

  if (!name) {
    throw new Error('Workspace name is required.')
  }

  if (name.length > MAX_WORKSPACE_NAME_LENGTH) {
    throw new Error(`Keep the workspace name under ${MAX_WORKSPACE_NAME_LENGTH} characters.`)
  }

  return name
}

function normalizeSupportEmail(value: string) {
  const email = normalizeEmail(value)

  if (!email) {
    throw new Error('Support email is required.')
  }

  if (email.length > MAX_SUPPORT_EMAIL_LENGTH || !isValidEmailAddress(email)) {
    throw new Error('Enter a valid support email address.')
  }

  return email
}

function normalizeTimezone(value: string) {
  const timezone = value.trim()

  if (!timezone) {
    throw new Error('Timezone is required.')
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
  } catch {
    throw new Error('Enter a valid IANA timezone, for example America/New_York.')
  }

  return timezone
}

function normalizeDefaultSlaDays(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 365) {
    throw new Error('Default SLA days must be a whole number between 1 and 365.')
  }

  return value
}

function normalizeBrandColor(value: string) {
  const brandColor = value.trim().toLowerCase()

  if (!BRAND_COLOR_PATTERN.test(brandColor)) {
    throw new Error('Brand color must be a 6-digit hex value like #537dc4.')
  }

  return brandColor
}

function normalizeLogoUrl(value: string | null | undefined) {
  const logoUrl = value?.trim() || null

  if (logoUrl === null) {
    return null
  }

  if (logoUrl.length > MAX_LOGO_URL_LENGTH) {
    throw new Error(`Keep the logo URL under ${MAX_LOGO_URL_LENGTH} characters.`)
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(logoUrl)
  } catch {
    throw new Error('Logo URL must be a valid http or https address.')
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Logo URL must start with http:// or https://.')
  }

  return parsedUrl.toString()
}

function normalizeAllowedRequestTypes(requestTypes: Doc<'requests'>['requestType'][]) {
  const selectedRequestTypes = new Set(requestTypes)
  const uniqueRequestTypes = DEFAULT_PUBLIC_REQUEST_TYPES.filter((requestType) =>
    selectedRequestTypes.has(requestType)
  )

  if (uniqueRequestTypes.length === 0) {
    throw new Error('Select at least one allowed request type.')
  }

  return uniqueRequestTypes
}

function buildDefaultPublicIntakeIntro(companyName: string) {
  return `Submit a privacy request to ${companyName}. We'll use the details below to route the case, track deadlines, and keep the request record up to date.`
}

function buildDefaultPublicIntakeSuccessMessage() {
  return 'Your request has been received. Keep your case ID for reference while the team reviews the case.'
}

function normalizePublicIntakeIntro(value: string, companyName: string) {
  const introCopy = value.trim().replace(/\s+/g, ' ')

  if (!introCopy) {
    return buildDefaultPublicIntakeIntro(companyName)
  }

  if (introCopy.length > MAX_PUBLIC_INTAKE_INTRO_LENGTH) {
    throw new Error(
      `Keep the public form intro copy under ${MAX_PUBLIC_INTAKE_INTRO_LENGTH} characters.`
    )
  }

  return introCopy
}

function normalizePublicIntakeSuccessMessage(value: string) {
  const successMessage = value.trim().replace(/\s+/g, ' ')

  if (!successMessage) {
    return buildDefaultPublicIntakeSuccessMessage()
  }

  if (successMessage.length > MAX_PUBLIC_INTAKE_SUCCESS_MESSAGE_LENGTH) {
    throw new Error(
      `Keep the success message under ${MAX_PUBLIC_INTAKE_SUCCESS_MESSAGE_LENGTH} characters.`
    )
  }

  return successMessage
}

export function getWorkspacePublicIntakeConfig(workspace: Doc<'workspaces'>) {
  const companyName = workspace.publicBrandName?.trim() || workspace.name
  const introCopy =
    workspace.publicIntakeIntro?.trim() ||
    buildDefaultPublicIntakeIntro(companyName)
  const successMessage =
    workspace.publicIntakeSuccessMessage?.trim() || buildDefaultPublicIntakeSuccessMessage()
  const { defaultSlaDays } = getWorkspaceSlaSettings(workspace)

  return {
    workspaceSlug: getWorkspaceSlug(workspace) ?? '',
    companyName,
    introCopy,
    successMessage,
    allowedRequestTypes: getAllowedPublicRequestTypes(workspace),
    supportEmail: getWorkspaceSupportEmail(workspace, { publicValue: true }),
    timezone: getWorkspaceTimezone(workspace),
    defaultSlaDays,
    brandColor: getWorkspaceBrandColor(workspace),
    logoUrl: getWorkspaceLogoUrl(workspace),
  }
}

export function getWorkspaceSlaSettings(workspace: Doc<'workspaces'>) {
  return {
    defaultSlaDays: Math.max(1, Math.round(workspace.defaultSlaDays ?? DEFAULT_WORKSPACE_SLA_DAYS)),
    publicRequestInitialStatus:
      workspace.publicRequestInitialStatus ?? DEFAULT_PUBLIC_REQUEST_STATUS,
  }
}

function getWorkspaceSettings(workspace: Doc<'workspaces'>) {
  const companyName = workspace.publicBrandName?.trim() || workspace.name

  return {
    name: workspace.name,
    supportEmail: getWorkspaceSupportEmail(workspace) ?? '',
    timezone: getWorkspaceTimezone(workspace),
    defaultSlaDays: getWorkspaceSlaSettings(workspace).defaultSlaDays,
    brandColor: getWorkspaceBrandColor(workspace),
    logoUrl: getWorkspaceLogoUrl(workspace) ?? '',
    allowedRequestTypes: getAllowedPublicRequestTypes(workspace),
    publicIntakeIntro:
      workspace.publicIntakeIntro?.trim() || buildDefaultPublicIntakeIntro(companyName),
    publicIntakeSuccessMessage:
      workspace.publicIntakeSuccessMessage?.trim() || buildDefaultPublicIntakeSuccessMessage(),
  }
}

async function createWorkspaceForIdentity(
  ctx: MutationCtx,
  input: {
    name: string
    tokenIdentifier: string
    email: string | null
    displayName: string | null
    isPersonal: boolean
  }
) {
  const name = normalizeWorkspaceName(input.name)
  const slug = await createUniqueWorkspaceSlug(ctx, name)
  const workspaceId = await ctx.db.insert('workspaces', {
    name,
    slug,
    publicBrandName: name,
    publicIntakeIntro: buildDefaultPublicIntakeIntro(name),
    publicIntakeSuccessMessage: buildDefaultPublicIntakeSuccessMessage(),
    allowedPublicRequestTypes: [...DEFAULT_PUBLIC_REQUEST_TYPES],
    supportEmail: input.email,
    timezone: DEFAULT_WORKSPACE_TIMEZONE,
    defaultSlaDays: DEFAULT_WORKSPACE_SLA_DAYS,
    brandColor: DEFAULT_WORKSPACE_BRAND_COLOR,
    logoUrl: null,
    plan: DEFAULT_WORKSPACE_PLAN,
    publicRequestInitialStatus: DEFAULT_PUBLIC_REQUEST_STATUS,
    createdByTokenIdentifier: input.tokenIdentifier,
    createdByEmail: input.email,
    isPersonal: input.isPersonal,
    archivedAt: null,
  })

  const memberId = await ctx.db.insert('workspaceMembers', {
    workspaceId,
    tokenIdentifier: input.tokenIdentifier,
    email: input.email,
    name: input.displayName,
    role: 'owner',
  })

  await ensureDefaultEmailTemplates(ctx, workspaceId)

  return { workspaceId, memberId }
}

async function createUniqueWorkspaceSlug(ctx: MutationCtx, workspaceName: string) {
  const baseSlug = normalizeWorkspaceSlug(workspaceName) || 'workspace'

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`
    const existingWorkspace = await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', candidate))
      .unique()

    if (existingWorkspace === null) {
      return candidate
    }
  }

  throw new Error('Unable to generate a workspace slug')
}

async function listAccessibleWorkspacesForTokenIdentifier(
  ctx: WorkspaceLookupCtx,
  tokenIdentifier: string
): Promise<WorkspaceMembershipEntry[]> {
  const memberships: Doc<'workspaceMembers'>[] = []

  for await (const membership of ctx.db
    .query('workspaceMembers')
    .withIndex('by_token_identifier_and_workspace_id', (q) =>
      q.eq('tokenIdentifier', tokenIdentifier)
    )) {
    memberships.push(membership)
  }

  const workspaces = await Promise.all(
    memberships.map(async (membership) => {
      const workspace = await ctx.db.get(membership.workspaceId)
      if (workspace === null || workspace.archivedAt !== null) {
        return null
      }

      return {
        membership,
        workspace,
      }
    })
  )

  return workspaces.filter((entry): entry is WorkspaceMembershipEntry => entry !== null)
}

async function assignWorkspaceSlugIfMissing(
  ctx: MutationCtx,
  workspace: Doc<'workspaces'>,
  preferredWorkspaceName: string
) {
  const existingSlug = getWorkspaceSlug(workspace)
  if (existingSlug !== null) {
    return existingSlug
  }

  const slug = await createUniqueWorkspaceSlug(ctx, preferredWorkspaceName)
  await ctx.db.patch(workspace._id, { slug })
  return slug
}

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    return await listAccessibleWorkspacesForTokenIdentifier(ctx, identity.tokenIdentifier)
  },
})

export const get = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const { membership, workspace } = await requireWorkspaceAccess(ctx, args.workspaceId)

    return {
      membership,
      workspace,
    }
  },
})

export const getSettings = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const { membership, workspace } = await requireWorkspaceAccess(ctx, args.workspaceId)
    const settings = getWorkspaceSettings(workspace)

    return {
      membershipRole: membership.role,
      workspaceSlug: getWorkspaceSlug(workspace),
      publicFormPath: buildPublicFormPath(workspace),
      ...settings,
    }
  },
})

export const getPublicIntakeWorkspace = query({
  args: {
    workspaceSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await findWorkspaceBySlug(ctx, args.workspaceSlug)

    if (workspace === null) {
      return null
    }

    const billing = await getWorkspaceBillingSnapshot(ctx, workspace)

    return {
      ...getWorkspacePublicIntakeConfig(workspace),
      plan: billing.plan,
      planLabel: billing.planLabel,
      requestIntakeOpen:
        getPublicIntakeBlockerMessage(workspace) === null && !billing.limits.requestVolumeReached,
      requestIntakeMessage:
        getPublicIntakeBlockerMessage(workspace) ??
        (billing.limits.requestVolumeReached ? billing.messages.requestVolume : null),
      requestsThisMonth: billing.usage.requestsThisMonth,
      requestLimit: billing.usage.requestLimit,
    }
  },
})

export const getBillingSnapshot = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const { membership, workspace } = await requireWorkspaceAccess(ctx, args.workspaceId)
    const billing = await getWorkspaceBillingSnapshot(ctx, workspace)

    return {
      membershipRole: membership.role,
      ...billing,
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    isPersonal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const name = normalizeWorkspaceName(args.name)

    const email = identity.email ? normalizeEmail(identity.email) : null
    return await createWorkspaceForIdentity(ctx, {
      name,
      tokenIdentifier: identity.tokenIdentifier,
      email,
      displayName: identity.name?.trim() || null,
      isPersonal: args.isPersonal ?? false,
    })
  },
})

export const updateSettings = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    name: v.string(),
    supportEmail: v.string(),
    timezone: v.string(),
    defaultSlaDays: v.number(),
    brandColor: v.string(),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    allowedRequestTypes: v.array(requestTypeValidator),
    publicIntakeIntro: v.string(),
    publicIntakeSuccessMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAccess(ctx, args.workspaceId)
    const name = normalizeWorkspaceName(args.name)
    const supportEmail = normalizeSupportEmail(args.supportEmail)
    const timezone = normalizeTimezone(args.timezone)
    const defaultSlaDays = normalizeDefaultSlaDays(args.defaultSlaDays)
    const brandColor = normalizeBrandColor(args.brandColor)
    const logoUrl = normalizeLogoUrl(args.logoUrl)
    const allowedRequestTypes = normalizeAllowedRequestTypes(args.allowedRequestTypes)
    const publicIntakeIntro = normalizePublicIntakeIntro(args.publicIntakeIntro, name)
    const publicIntakeSuccessMessage = normalizePublicIntakeSuccessMessage(
      args.publicIntakeSuccessMessage
    )

    assertWorkspaceCanUseCustomBranding({
      workspace,
      brandColor,
      logoUrl,
    })

    const workspaceSlug = await assignWorkspaceSlugIfMissing(ctx, workspace, name)

    await ctx.db.patch(workspace._id, {
      name,
      slug: workspaceSlug,
      publicBrandName: name,
      publicIntakeIntro,
      publicIntakeSuccessMessage,
      supportEmail,
      timezone,
      defaultSlaDays,
      brandColor,
      logoUrl,
      allowedPublicRequestTypes: allowedRequestTypes,
    })

    return {
      workspaceId: workspace._id,
      workspaceSlug,
      settings: {
        name,
        supportEmail,
        timezone,
        defaultSlaDays,
        brandColor,
        logoUrl: logoUrl ?? '',
        allowedRequestTypes,
        publicIntakeIntro,
        publicIntakeSuccessMessage,
      },
    }
  },
})

export const ensureWorkspaceSlug = mutation({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAccess(ctx, args.workspaceId)
    const workspaceSlug = await assignWorkspaceSlugIfMissing(
      ctx,
      workspace,
      workspace.publicBrandName?.trim() || workspace.name
    )

    return {
      workspaceId: workspace._id,
      workspaceSlug,
      publicFormPath: isPublicIntakeConfigured(workspace) ? `/request/${workspaceSlug}` : null,
    }
  },
})

export const syncPlan = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    plan: workspacePlanValidator,
  },
  handler: async (ctx, args) => {
    const { membership, workspace } = await requireWorkspaceAccess(ctx, args.workspaceId)

    if (membership.role !== 'owner') {
      throw new Error('Only workspace owners can sync billing plan changes.')
    }

    if (workspace.plan === args.plan) {
      return {
        workspaceId: workspace._id,
        plan: workspace.plan ?? DEFAULT_WORKSPACE_PLAN,
      }
    }

    await ctx.db.patch(workspace._id, {
      plan: args.plan,
    })

    return {
      workspaceId: workspace._id,
      plan: args.plan,
    }
  },
})

export const bootstrapDefaultWorkspace = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const existingWorkspaces = await listAccessibleWorkspacesForTokenIdentifier(
      ctx,
      identity.tokenIdentifier
    )

    if (existingWorkspaces.length > 0) {
      return {
        created: false,
        workspaceId: existingWorkspaces[0].workspace._id,
      }
    }

    const proposedName = args.name?.trim() || getDefaultWorkspaceName(identity)
    const email = identity.email ? normalizeEmail(identity.email) : null
    const { workspaceId } = await createWorkspaceForIdentity(ctx, {
      name: proposedName,
      tokenIdentifier: identity.tokenIdentifier,
      email,
      displayName: identity.name?.trim() || null,
      isPersonal: true,
    })

    return {
      created: true,
      workspaceId,
    }
  },
})

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
