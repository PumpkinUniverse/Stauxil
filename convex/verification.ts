import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { mutation, query, type MutationCtx } from './_generated/server'
import { requireRequestAccess } from './lib/access'
import { buildVerificationUrl, queueVerificationEmail } from './lib/verificationEmail'
import { insertRequestEvent } from './requestEvents'
import { findWorkspaceBySlug, getWorkspacePublicIntakeConfig } from './workspaces'

const DEFAULT_TOKEN_TTL_MINUTES = 60

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function generateMagicLinkToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

async function expirePendingTokensForRequest(
  ctx: MutationCtx,
  workspaceId: Id<'workspaces'>,
  requestId: Id<'requests'>
) {
  for await (const token of ctx.db
    .query('verificationTokens')
    .withIndex('by_workspace_id_and_request_id', (q) =>
      q.eq('workspaceId', workspaceId).eq('requestId', requestId)
    )) {
    if (token.status === 'pending') {
      await ctx.db.patch(token._id, {
        status: 'expired',
      })
    }
  }
}

export function getVerificationEmailAddress(request: Doc<'requests'>) {
  return request.requesterEmail ?? request.subjectEmail
}

type IssueVerificationTokenArgs = {
  workspace: Doc<'workspaces'>
  request: Doc<'requests'>
  email: string
  ttlMinutes?: number
  createdByMemberId: Id<'workspaceMembers'> | null
  actorType: 'member' | 'system'
}

export async function issueVerificationToken(
  ctx: MutationCtx,
  args: IssueVerificationTokenArgs
) {
  if (args.request.verificationStatus === 'verified') {
    throw new Error('This request is already verified.')
  }

  const now = Date.now()
  const ttlMinutes = Math.min(Math.max(args.ttlMinutes ?? DEFAULT_TOKEN_TTL_MINUTES, 5), 24 * 60)

  await expirePendingTokensForRequest(ctx, args.workspace._id, args.request._id)

  const token = generateMagicLinkToken()
  const expiresAt = now + ttlMinutes * 60 * 1000
  const tokenHash = await sha256Hex(token)
  const tokenId = await ctx.db.insert('verificationTokens', {
    workspaceId: args.workspace._id,
    requestId: args.request._id,
    email: args.email,
    tokenHash,
    status: 'pending',
    expiresAt,
    consumedAt: null,
    lastSentAt: null,
    attemptCount: 0,
    createdByMemberId: args.createdByMemberId,
  })

  await ctx.db.patch(args.request._id, {
    verificationStatus: 'pending',
    verifiedAt: null,
  })

  await insertRequestEvent(ctx, {
    workspaceId: args.workspace._id,
    requestId: args.request._id,
    actorType: args.actorType,
    actorMemberId: args.createdByMemberId,
    eventType: 'verification_requested',
    message: 'Created a verification link',
    details: {
      email: args.email,
    },
  })

  return {
    tokenId,
    token,
    email: args.email,
    expiresAt,
  }
}

type SendVerificationEmailArgs = {
  workspace: Doc<'workspaces'>
  request: Doc<'requests'>
  email: string
  tokenId: Id<'verificationTokens'>
  token: string
  expiresAt: number
  createdByMemberId: Id<'workspaceMembers'> | null
}

export async function sendVerificationEmail(
  ctx: MutationCtx,
  args: SendVerificationEmailArgs
) {
  const workspaceSlug = args.workspace.slug

  if (!workspaceSlug) {
    throw new Error('Workspace is missing a public slug.')
  }

  const verificationUrl = buildVerificationUrl({
    workspaceSlug,
    token: args.token,
  })

  const delivery = await queueVerificationEmail(ctx, {
    workspace: args.workspace,
    request: args.request,
    toEmail: args.email,
    verificationUrl,
    expiresAt: args.expiresAt,
    createdByMemberId: args.createdByMemberId,
  })

  await ctx.scheduler.runAfter(0, internal.verificationDelivery.deliverVerificationEmail, {
    workspaceId: args.workspace._id,
    requestId: args.request._id,
    tokenId: args.tokenId,
    emailLogId: delivery.emailLogId,
    toEmail: delivery.toEmail,
    subject: delivery.subject,
    body: delivery.body,
  })

  return {
    ...delivery,
    verificationUrl,
  }
}

export const listByRequest = query({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRequestAccess(ctx, args.workspaceId, args.requestId)

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
    const tokens = await ctx.db
      .query('verificationTokens')
      .withIndex('by_workspace_id_and_request_id', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('requestId', args.requestId)
      )
      .order('desc')
      .take(limit)

    return tokens.map((token) => ({
      _id: token._id,
      _creationTime: token._creationTime,
      workspaceId: token.workspaceId,
      requestId: token.requestId,
      email: token.email,
      status: token.status,
      expiresAt: token.expiresAt,
      consumedAt: token.consumedAt,
      lastSentAt: token.lastSentAt,
      attemptCount: token.attemptCount,
      createdByMemberId: token.createdByMemberId,
    }))
  },
})

export const createToken = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    ttlMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { membership, request, workspace } = await requireRequestAccess(
      ctx,
      args.workspaceId,
      args.requestId
    )

    const issuedToken = await issueVerificationToken(ctx, {
      workspace,
      request,
      email: getVerificationEmailAddress(request),
      ttlMinutes: args.ttlMinutes,
      createdByMemberId: membership._id,
      actorType: 'member',
    })

    await sendVerificationEmail(ctx, {
      workspace,
      request,
      email: issuedToken.email,
      tokenId: issuedToken.tokenId,
      token: issuedToken.token,
      expiresAt: issuedToken.expiresAt,
      createdByMemberId: membership._id,
    })

    return {
      tokenId: issuedToken.tokenId,
      expiresAt: issuedToken.expiresAt,
    }
  },
})

export const markVerifiedManually = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { membership, request } = await requireRequestAccess(
      ctx,
      args.workspaceId,
      args.requestId
    )

    if (request.verificationStatus === 'not_required') {
      throw new Error('This request does not currently require email verification.')
    }

    if (request.verificationStatus === 'verified' && request.verifiedAt !== null) {
      return {
        requestId: request._id,
        verifiedAt: request.verifiedAt,
      }
    }

    const note = args.note?.trim()
    const now = Date.now()

    await expirePendingTokensForRequest(ctx, args.workspaceId, request._id)
    await ctx.db.patch(request._id, {
      verificationStatus: 'verified',
      verifiedAt: now,
    })

    await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId: request._id,
      actorType: 'member',
      actorMemberId: membership._id,
      eventType: 'verification_manually_completed',
      message: note
        ? `Marked requester email as verified manually. ${note}`
        : 'Marked requester email as verified manually',
      details: {
        previousStatus: request.verificationStatus,
        nextStatus: 'verified',
      },
    })

    return {
      requestId: request._id,
      verifiedAt: now,
    }
  },
})

export const verifyPublicToken = mutation({
  args: {
    workspaceSlug: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await findWorkspaceBySlug(ctx, args.workspaceSlug)
    const companyName =
      workspace === null ? 'Stauxil' : getWorkspacePublicIntakeConfig(workspace).companyName
    const workspaceSlug = workspace?.slug ?? args.workspaceSlug
    const invalidResponse = {
      status: 'invalid' as const,
      companyName,
      workspaceSlug,
      caseId: null,
    }

    if (workspace === null) {
      return invalidResponse
    }

    const tokenValue = args.token.trim()
    if (!tokenValue) {
      return invalidResponse
    }

    const now = Date.now()
    const tokenHash = await sha256Hex(tokenValue)
    const verificationToken = await ctx.db
      .query('verificationTokens')
      .withIndex('by_workspace_id_and_token_hash', (q) =>
        q.eq('workspaceId', workspace._id).eq('tokenHash', tokenHash)
      )
      .unique()

    if (verificationToken === null) {
      return invalidResponse
    }

    const request = await ctx.db.get(verificationToken.requestId)
    if (request === null || request.workspaceId !== workspace._id || request.archivedAt !== null) {
      return invalidResponse
    }

    const baseResponse = {
      companyName,
      workspaceSlug,
      caseId: request.caseId ?? null,
    }

    if (verificationToken.status !== 'pending') {
      return {
        status: verificationToken.status === 'expired' ? ('expired' as const) : ('invalid' as const),
        ...baseResponse,
      }
    }

    const nextAttemptCount = verificationToken.attemptCount + 1

    if (verificationToken.expiresAt <= now) {
      await ctx.db.patch(verificationToken._id, {
        status: 'expired',
        attemptCount: nextAttemptCount,
      })

      if (request.verificationStatus !== 'verified') {
        await ctx.db.patch(request._id, {
          verificationStatus: 'expired',
        })
      }

      await insertRequestEvent(ctx, {
        workspaceId: workspace._id,
        requestId: request._id,
        actorType: 'requester',
        actorMemberId: null,
        eventType: 'verification_link_expired',
        message: 'Attempted to use an expired verification link',
      })

      return {
        status: 'expired' as const,
        ...baseResponse,
      }
    }

    await ctx.db.patch(verificationToken._id, {
      status: 'verified',
      consumedAt: now,
      attemptCount: nextAttemptCount,
    })

    for await (const relatedToken of ctx.db
      .query('verificationTokens')
      .withIndex('by_workspace_id_and_request_id', (q) =>
        q.eq('workspaceId', workspace._id).eq('requestId', request._id)
      )) {
      if (relatedToken._id !== verificationToken._id && relatedToken.status === 'pending') {
        await ctx.db.patch(relatedToken._id, {
          status: 'expired',
        })
      }
    }

    await ctx.db.patch(request._id, {
      verificationStatus: 'verified',
      verifiedAt: now,
    })

    await insertRequestEvent(ctx, {
      workspaceId: workspace._id,
      requestId: request._id,
      actorType: 'requester',
      actorMemberId: null,
      eventType: 'request_verified',
      message: 'Verified the requester email',
    })

    return {
      status: 'verified' as const,
      verifiedAt: now,
      ...baseResponse,
    }
  },
})
