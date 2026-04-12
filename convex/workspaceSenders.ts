import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { internal } from './_generated/api'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { normalizeEmail, requireWorkspaceAccess } from './lib/access'
import {
  createResendDomain,
  findResendDomainByName,
  getResendDomain,
  normalizeSenderDomainName,
  toStoredResendDomainRecords,
  type ResendDomain,
  verifyResendDomain,
} from './lib/resendDomains'
import { workspaceSenderStatusValidator } from './validators'

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_SENDER_EMAIL_LENGTH = 254
const MAX_SENDER_DISPLAY_NAME_LENGTH = 80

type SenderSetupCtx = QueryCtx | MutationCtx
type WorkspaceSenderDoc = Doc<'workspaceSenders'>
type WorkspaceSenderStatus = Doc<'workspaceSenders'>['status']

type SenderSetupView = {
  provider: 'resend'
  isPersisted: boolean
  fromEmail: string
  displayName: string
  derivedDomain: string | null
  status: WorkspaceSenderStatus
  providerDomainId: string | null
  verifiedDomain: string | null
  dnsRecords: WorkspaceSenderDoc['dnsRecords']
  fallbackMode: 'platform'
  lastCheckedAt: number | null
  verifiedAt: number | null
  failureReason: string | null
}

export async function getWorkspaceSenderSetupValue(
  ctx: SenderSetupCtx,
  workspace: Pick<
    Doc<'workspaces'>,
    '_id' | 'name' | 'publicBrandName' | 'supportEmail' | 'createdByEmail'
  >
): Promise<SenderSetupView> {
  const sender = await getPersistedWorkspaceSender(ctx, workspace._id)
  return buildSenderSetupView(workspace, sender)
}

export const getWorkspaceSenderSetup = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAccess(ctx, args.workspaceId)
    return await getWorkspaceSenderSetupValue(ctx, workspace)
  },
})

export const saveWorkspaceSenderSetup = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    fromEmail: v.string(),
    displayName: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceOwner(ctx, args.workspaceId)
    const fromEmail = normalizeSenderEmail(args.fromEmail)
    const displayName = normalizeSenderDisplayName(
      args.displayName,
      workspace.publicBrandName?.trim() || workspace.name
    )

    const existing = await getPersistedWorkspaceSender(ctx, workspace._id)
    const nextDomain = getSenderDomainFromEmail(fromEmail)
    const existingDomain = existing ? getSenderDomainFromEmail(existing.fromEmail) : null
    const sameDomain = existing !== null && existingDomain === nextDomain

    if (existing === null) {
      await ctx.db.insert('workspaceSenders', {
        workspaceId: workspace._id,
        provider: 'resend',
        fromEmail,
        displayName,
        status: 'not_started',
        providerDomainId: null,
        verifiedDomain: null,
        dnsRecords: [],
        fallbackMode: 'platform',
        lastCheckedAt: null,
        verifiedAt: null,
        failureReason: null,
      })
    } else {
      const nextStatus =
        sameDomain && existing.status !== 'draft' ? existing.status : ('not_started' as const)

      await ctx.db.patch(existing._id, {
        fromEmail,
        displayName,
        status: nextStatus,
        ...(sameDomain
          ? {}
          : {
              providerDomainId: null,
              verifiedDomain: null,
              dnsRecords: [],
              lastCheckedAt: null,
              verifiedAt: null,
              failureReason: null,
            }),
      })
    }

    return await getWorkspaceSenderSetupValue(ctx, workspace)
  },
})

export const disableWorkspaceSender = mutation({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceOwner(ctx, args.workspaceId)
    const existing = await getPersistedWorkspaceSender(ctx, workspace._id)

    if (existing === null) {
      throw new Error('Save a sender email before disabling workspace sender delivery.')
    }

    await ctx.db.patch(existing._id, {
      status: 'disabled',
      failureReason: null,
      lastCheckedAt: Date.now(),
    })

    return await getWorkspaceSenderSetupValue(ctx, workspace)
  },
})

export const startWorkspaceSenderVerification = action({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const setup: SenderSetupView = await ctx.runQuery(
      internal.workspaceSenders.getWorkspaceSenderActionContext,
      {
        workspaceId: args.workspaceId,
      }
    )

    if (!setup.isPersisted) {
      throw new Error('Save the sender email before starting domain verification.')
    }

    const senderDomain = setup.derivedDomain
    if (!senderDomain) {
      throw new Error('Enter a valid sender email before starting domain verification.')
    }

    try {
      const existingDomain = await findResendDomainByName(senderDomain)
      const domain = existingDomain ?? (await createResendDomain(senderDomain))
      const nextDomainState =
        domain.status === 'verified' ? domain : await verifyResendDomain(domain.id)

      await ctx.runMutation(internal.workspaceSenders.syncWorkspaceSenderFromProvider, {
        workspaceId: args.workspaceId,
        providerDomainId: nextDomainState.id,
        verifiedDomain: nextDomainState.status === 'verified' ? nextDomainState.name : null,
        dnsRecords: toStoredResendDomainRecords(nextDomainState.records),
        status: mapProviderDomainStatus(nextDomainState, { verificationTriggered: true }),
        lastCheckedAt: Date.now(),
        verifiedAt: nextDomainState.status === 'verified' ? setup.verifiedAt ?? Date.now() : null,
        failureReason: getDomainFailureReason(nextDomainState),
      })
    } catch (error) {
      await ctx.runMutation(internal.workspaceSenders.recordWorkspaceSenderFailure, {
        workspaceId: args.workspaceId,
        status: 'temporary_failure',
        failureReason: getErrorMessage(error),
      })
      throw error
    }

    const nextSetup: SenderSetupView = await ctx.runQuery(apiWorkspaceSenderSetup, {
      workspaceId: args.workspaceId,
    })

    return nextSetup
  },
})

export const refreshWorkspaceSenderStatus = action({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const setup: SenderSetupView = await ctx.runQuery(
      internal.workspaceSenders.getWorkspaceSenderActionContext,
      {
        workspaceId: args.workspaceId,
      }
    )

    if (!setup.isPersisted || !setup.providerDomainId) {
      throw new Error('Start domain verification before refreshing sender status.')
    }

    try {
      const domain = await getResendDomain(setup.providerDomainId)
      await ctx.runMutation(internal.workspaceSenders.syncWorkspaceSenderFromProvider, {
        workspaceId: args.workspaceId,
        providerDomainId: domain.id,
        verifiedDomain: domain.status === 'verified' ? domain.name : null,
        dnsRecords: toStoredResendDomainRecords(domain.records),
        status: mapProviderDomainStatus(domain),
        lastCheckedAt: Date.now(),
        verifiedAt: domain.status === 'verified' ? setup.verifiedAt ?? Date.now() : null,
        failureReason: getDomainFailureReason(domain),
      })
    } catch (error) {
      await ctx.runMutation(internal.workspaceSenders.recordWorkspaceSenderFailure, {
        workspaceId: args.workspaceId,
        status: 'temporary_failure',
        failureReason: getErrorMessage(error),
      })
      throw error
    }

    const nextSetup: SenderSetupView = await ctx.runQuery(apiWorkspaceSenderSetup, {
      workspaceId: args.workspaceId,
    })

    return nextSetup
  },
})

export const getWorkspaceSenderActionContext = internalQuery({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceOwner(ctx, args.workspaceId)
    return await getWorkspaceSenderSetupValue(ctx, workspace)
  },
})

export const getWorkspaceSenderDeliverySnapshot = internalQuery({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId)
    if (workspace === null || workspace.archivedAt !== null) {
      return null
    }

    const sender = await getPersistedWorkspaceSender(ctx, args.workspaceId)
    return {
      workspaceName: workspace.publicBrandName?.trim() || workspace.name,
      supportEmail: getWorkspaceSupportEmailSeed(workspace),
      sender:
        sender === null
          ? null
          : {
              fromEmail: sender.fromEmail,
              displayName: sender.displayName,
              status: sender.status,
              providerDomainId: sender.providerDomainId,
              verifiedDomain: sender.verifiedDomain,
              fallbackMode: sender.fallbackMode,
              failureReason: sender.failureReason,
            },
    }
  },
})

export const syncWorkspaceSenderFromProvider = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    providerDomainId: v.union(v.string(), v.null()),
    verifiedDomain: v.union(v.string(), v.null()),
    dnsRecords: v.array(
      v.object({
        record: v.string(),
        name: v.string(),
        type: v.string(),
        ttl: v.string(),
        status: v.string(),
        value: v.string(),
        priority: v.optional(v.number()),
      })
    ),
    status: workspaceSenderStatusValidator,
    lastCheckedAt: v.number(),
    verifiedAt: v.union(v.number(), v.null()),
    failureReason: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const sender = await getRequiredWorkspaceSender(ctx, args.workspaceId)
    const verifiedAt =
      args.status === 'verified' ? args.verifiedAt ?? sender.verifiedAt ?? args.lastCheckedAt : null

    await ctx.db.patch(sender._id, {
      providerDomainId: args.providerDomainId,
      verifiedDomain: args.verifiedDomain,
      dnsRecords: args.dnsRecords,
      status: args.status,
      lastCheckedAt: args.lastCheckedAt,
      verifiedAt,
      failureReason: args.failureReason,
    })

    return sender._id
  },
})

export const recordWorkspaceSenderFailure = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    status: workspaceSenderStatusValidator,
    failureReason: v.string(),
  },
  handler: async (ctx, args) => {
    const sender = await getRequiredWorkspaceSender(ctx, args.workspaceId)
    await ctx.db.patch(sender._id, {
      status: args.status,
      failureReason: args.failureReason.trim(),
      lastCheckedAt: Date.now(),
    })

    return sender._id
  },
})

async function requireWorkspaceOwner(ctx: QueryCtx | MutationCtx, workspaceId: Doc<'workspaces'>['_id']) {
  const access = await requireWorkspaceAccess(ctx, workspaceId)
  if (access.membership.role !== 'owner') {
    throw new Error('Only workspace owners can manage outbound sender settings.')
  }

  return access
}

async function getPersistedWorkspaceSender(ctx: SenderSetupCtx, workspaceId: Doc<'workspaces'>['_id']) {
  return await ctx.db
    .query('workspaceSenders')
    .withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId))
    .unique()
}

async function getRequiredWorkspaceSender(ctx: MutationCtx, workspaceId: Doc<'workspaces'>['_id']) {
  const sender = await getPersistedWorkspaceSender(ctx, workspaceId)
  if (sender === null) {
    throw new Error('Workspace sender setup not found.')
  }

  return sender
}

function buildSenderSetupView(
  workspace: Pick<
    Doc<'workspaces'>,
    '_id' | 'name' | 'publicBrandName' | 'supportEmail' | 'createdByEmail'
  >,
  sender: WorkspaceSenderDoc | null
): SenderSetupView {
  const fallbackFromEmail = getWorkspaceSupportEmailSeed(workspace) ?? ''
  const fromEmail = sender?.fromEmail ?? fallbackFromEmail
  const displayName =
    sender?.displayName?.trim() || workspace.publicBrandName?.trim() || workspace.name

  return {
    provider: 'resend',
    isPersisted: sender !== null,
    fromEmail,
    displayName,
    derivedDomain: fromEmail ? getSenderDomainFromEmail(fromEmail) : null,
    status: sender?.status ?? 'draft',
    providerDomainId: sender?.providerDomainId ?? null,
    verifiedDomain: sender?.verifiedDomain ?? null,
    dnsRecords: sender?.dnsRecords ?? [],
    fallbackMode: sender?.fallbackMode ?? 'platform',
    lastCheckedAt: sender?.lastCheckedAt ?? null,
    verifiedAt: sender?.verifiedAt ?? null,
    failureReason: sender?.failureReason ?? null,
  }
}

function getWorkspaceSupportEmailSeed(
  workspace: Pick<Doc<'workspaces'>, 'supportEmail' | 'createdByEmail'>
) {
  const supportEmail = workspace.supportEmail?.trim()
  if (supportEmail) {
    return supportEmail
  }

  const createdByEmail = workspace.createdByEmail?.trim()
  return createdByEmail || null
}

function normalizeSenderEmail(value: string) {
  const email = normalizeEmail(value)
  if (!email) {
    throw new Error('Sender email is required.')
  }

  if (email.length > MAX_SENDER_EMAIL_LENGTH || !EMAIL_ADDRESS_PATTERN.test(email)) {
    throw new Error('Enter a valid sender email address.')
  }

  return email
}

function normalizeSenderDisplayName(value: string | null | undefined, fallbackValue: string) {
  const displayName = value?.trim().replace(/\s+/g, ' ') || fallbackValue.trim()

  if (!displayName) {
    throw new Error('Sender display name is required.')
  }

  if (displayName.length > MAX_SENDER_DISPLAY_NAME_LENGTH) {
    throw new Error(`Keep the sender display name under ${MAX_SENDER_DISPLAY_NAME_LENGTH} characters.`)
  }

  return displayName
}

function getSenderDomainFromEmail(email: string) {
  const [, domain = ''] = email.split('@')
  const normalizedDomain = normalizeSenderDomainName(domain)
  return normalizedDomain || null
}

function mapProviderDomainStatus(
  domain: Pick<ResendDomain, 'status'>,
  options?: { verificationTriggered?: boolean }
): WorkspaceSenderStatus {
  const providerStatus = domain.status.trim().toLowerCase()

  if (providerStatus === 'verified') {
    return 'verified'
  }

  if (providerStatus === 'failed') {
    return 'failed'
  }

  if (providerStatus === 'temporary_failure') {
    return 'temporary_failure'
  }

  if (providerStatus === 'pending') {
    return 'pending'
  }

  if (providerStatus === 'not_started') {
    return options?.verificationTriggered ? 'pending' : 'not_started'
  }

  return 'pending'
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return 'Unable to sync the workspace sender.'
}

function getDomainFailureReason(domain: Pick<ResendDomain, 'status'>) {
  const providerStatus = domain.status.trim().toLowerCase()

  if (providerStatus === 'failed') {
    return 'Resend reported the workspace sender domain as failed.'
  }

  if (providerStatus === 'temporary_failure') {
    return 'Resend reported a temporary failure while checking the workspace sender domain.'
  }

  return null
}

const apiWorkspaceSenderSetup = internal.workspaceSenders.getWorkspaceSenderActionContext

export type { SenderSetupView }
