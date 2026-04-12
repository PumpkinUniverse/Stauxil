import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx } from './_generated/server'
import { normalizeEmail, requireRequestAccess, requireWorkspaceAccess } from './lib/access'
import { insertRequestEvent } from './requestEvents'
import {
  emailDeliveryModeValidator,
  emailLogStatusValidator,
  emailSenderSourceValidator,
} from './validators'

type CreateEmailLogEntryArgs = {
  workspaceId: Id<'workspaces'>
  requestId: Id<'requests'> | null
  templateId: Id<'emailTemplates'> | null
  templateKey: string | null
  toEmail: string
  subject: string
  body: string
  status: 'draft' | 'queued' | 'sent' | 'failed'
  deliveryMode?: 'simulated' | 'provider'
  fromEmail?: string | null
  replyToEmail?: string | null
  senderSource?: 'platform' | 'workspace' | null
  providerName?: string | null
  errorMessage?: string | null
  createdByMemberId: Id<'workspaceMembers'> | null
}

export async function createEmailLogEntry(ctx: MutationCtx, args: CreateEmailLogEntryArgs) {
  const status = args.status

  return await ctx.db.insert('emailLogs', {
    workspaceId: args.workspaceId,
    requestId: args.requestId,
    templateId: args.templateId,
    templateKey: args.templateKey,
    toEmail: normalizeEmail(args.toEmail),
    subject: args.subject.trim(),
    body: args.body.trim(),
    status,
    deliveryMode: args.deliveryMode,
    fromEmail: args.fromEmail ?? null,
    replyToEmail: args.replyToEmail ?? null,
    senderSource: args.senderSource ?? undefined,
    providerName: args.providerName ?? null,
    errorMessage: args.errorMessage ?? null,
    sentAt: status === 'sent' ? Date.now() : null,
    createdByMemberId: args.createdByMemberId,
  })
}

export const listByWorkspace = query({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.optional(v.union(v.id('requests'), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100)
    const requestId = args.requestId ?? null

    if (requestId !== null) {
      await requireRequestAccess(ctx, args.workspaceId, requestId)
      return await ctx.db
        .query('emailLogs')
        .withIndex('by_workspace_id_and_request_id', (q) =>
          q.eq('workspaceId', args.workspaceId).eq('requestId', requestId)
        )
        .order('desc')
        .take(limit)
    }

    await requireWorkspaceAccess(ctx, args.workspaceId)
    return await ctx.db
      .query('emailLogs')
      .withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')
      .take(limit)
  },
})

export const create = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.optional(v.union(v.id('requests'), v.null())),
    templateId: v.optional(v.union(v.id('emailTemplates'), v.null())),
    templateKey: v.optional(v.union(v.string(), v.null())),
    toEmail: v.string(),
    subject: v.string(),
    body: v.string(),
    status: v.optional(emailLogStatusValidator),
    deliveryMode: v.optional(emailDeliveryModeValidator),
    fromEmail: v.optional(v.union(v.string(), v.null())),
    replyToEmail: v.optional(v.union(v.string(), v.null())),
    senderSource: v.optional(v.union(emailSenderSourceValidator, v.null())),
    providerName: v.optional(v.union(v.string(), v.null())),
    errorMessage: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const status = args.status ?? 'draft'
    const requestId = args.requestId ?? null
    const templateId = args.templateId ?? null
    const templateKey = args.templateKey ?? null

    let createdByMemberId = null
    if (requestId !== null) {
      const access = await requireRequestAccess(ctx, args.workspaceId, requestId)
      createdByMemberId = access.membership._id
    } else {
      const access = await requireWorkspaceAccess(ctx, args.workspaceId)
      createdByMemberId = access.membership._id
    }

    const emailLogId = await createEmailLogEntry(ctx, {
      workspaceId: args.workspaceId,
      requestId,
      templateId,
      templateKey,
      toEmail: args.toEmail,
      subject: args.subject,
      body: args.body,
      status,
      deliveryMode: args.deliveryMode,
      fromEmail: args.fromEmail,
      replyToEmail: args.replyToEmail,
      senderSource: args.senderSource,
      providerName: args.providerName,
      errorMessage: args.errorMessage,
      createdByMemberId,
    })

    if (requestId !== null) {
      await insertRequestEvent(ctx, {
        workspaceId: args.workspaceId,
        requestId,
        actorType: 'member',
        actorMemberId: createdByMemberId,
        eventType: 'email_logged',
        message: `Recorded an email log with status ${status}`,
        details: {
          delivery: args.deliveryMode ?? 'unspecified',
        },
      })
    }

    return emailLogId
  },
})

export const updateStatus = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    emailLogId: v.id('emailLogs'),
    status: emailLogStatusValidator,
    errorMessage: v.optional(v.union(v.string(), v.null())),
    deliveryMode: v.optional(emailDeliveryModeValidator),
    fromEmail: v.optional(v.union(v.string(), v.null())),
    replyToEmail: v.optional(v.union(v.string(), v.null())),
    senderSource: v.optional(v.union(emailSenderSourceValidator, v.null())),
    providerName: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)

    const emailLog = await ctx.db.get(args.emailLogId)
    if (emailLog === null || emailLog.workspaceId !== args.workspaceId) {
      throw new Error('Email log not found')
    }

    await ctx.db.patch(emailLog._id, {
      status: args.status,
      deliveryMode: args.deliveryMode ?? emailLog.deliveryMode,
      fromEmail: args.fromEmail ?? emailLog.fromEmail,
      replyToEmail: args.replyToEmail ?? emailLog.replyToEmail,
      senderSource: args.senderSource ?? emailLog.senderSource ?? undefined,
      providerName: args.providerName ?? emailLog.providerName,
      errorMessage: args.errorMessage ?? emailLog.errorMessage,
      sentAt: args.status === 'sent' ? Date.now() : emailLog.sentAt,
    })

    if (emailLog.requestId !== null) {
      const access = await requireRequestAccess(ctx, args.workspaceId, emailLog.requestId)
      await insertRequestEvent(ctx, {
        workspaceId: args.workspaceId,
        requestId: emailLog.requestId,
        actorType: 'member',
        actorMemberId: access.membership._id,
        eventType: 'email_status_updated',
        message: `Updated email log to ${args.status}`,
        details: {
          delivery: args.deliveryMode ?? emailLog.deliveryMode ?? 'unspecified',
        },
      })
    }

    return emailLog._id
  },
})
