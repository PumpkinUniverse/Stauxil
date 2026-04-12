import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import {
  getTransactionalEmailDefaults,
  sendTransactionalEmail,
} from './lib/emailProvider'
import { insertRequestEvent } from './requestEvents'

type DeliverySnapshot = {
  emailLogStatus: 'draft' | 'queued' | 'sent' | 'failed'
  supportEmail: string | null
}

export const getDeliverySnapshot = internalQuery({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    tokenId: v.id('verificationTokens'),
    emailLogId: v.id('emailLogs'),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId)
    const request = await ctx.db.get(args.requestId)
    const token = await ctx.db.get(args.tokenId)
    const emailLog = await ctx.db.get(args.emailLogId)

    if (
      workspace === null ||
      workspace.archivedAt !== null ||
      request === null ||
      request.workspaceId !== args.workspaceId ||
      request.archivedAt !== null ||
      token === null ||
      token.workspaceId !== args.workspaceId ||
      token.requestId !== args.requestId ||
      emailLog === null ||
      emailLog.workspaceId !== args.workspaceId ||
      emailLog.requestId !== args.requestId
    ) {
      return null
    }

    return {
      emailLogStatus: emailLog.status,
      supportEmail: getWorkspaceSupportEmail(workspace.supportEmail),
    }
  },
})

export const getRequestEmailDeliverySnapshot = internalQuery({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    emailLogId: v.id('emailLogs'),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId)
    const request = await ctx.db.get(args.requestId)
    const emailLog = await ctx.db.get(args.emailLogId)

    if (
      workspace === null ||
      workspace.archivedAt !== null ||
      request === null ||
      request.workspaceId !== args.workspaceId ||
      request.archivedAt !== null ||
      emailLog === null ||
      emailLog.workspaceId !== args.workspaceId ||
      emailLog.requestId !== args.requestId
    ) {
      return null
    }

    return {
      emailLogStatus: emailLog.status,
      supportEmail: getWorkspaceSupportEmail(workspace.supportEmail),
    }
  },
})

export const finalizeVerificationEmailDelivery = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    tokenId: v.id('verificationTokens'),
    emailLogId: v.id('emailLogs'),
    outcome: v.union(v.literal('sent'), v.literal('failed')),
    providerName: v.optional(v.union(v.string(), v.null())),
    fromEmail: v.optional(v.union(v.string(), v.null())),
    replyToEmail: v.optional(v.union(v.string(), v.null())),
    errorMessage: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId)
    const token = await ctx.db.get(args.tokenId)
    const emailLog = await ctx.db.get(args.emailLogId)

    if (
      request === null ||
      request.workspaceId !== args.workspaceId ||
      token === null ||
      token.workspaceId !== args.workspaceId ||
      token.requestId !== args.requestId ||
      emailLog === null ||
      emailLog.workspaceId !== args.workspaceId ||
      emailLog.requestId !== args.requestId
    ) {
      throw new Error('Verification delivery state could not be loaded.')
    }

    if (emailLog.status !== 'queued') {
      return {
        emailLogId: emailLog._id,
        outcome: emailLog.status,
      }
    }

    const now = Date.now()
    const actorType = emailLog.createdByMemberId === null ? 'system' : 'member'

    if (args.outcome === 'sent') {
      await ctx.db.patch(emailLog._id, {
        status: 'sent',
        deliveryMode: 'provider',
        fromEmail: args.fromEmail ?? emailLog.fromEmail,
        replyToEmail: args.replyToEmail ?? emailLog.replyToEmail,
        senderSource: 'platform',
        providerName: args.providerName ?? emailLog.providerName,
        errorMessage: null,
        sentAt: now,
      })

      await ctx.db.patch(token._id, {
        lastSentAt: now,
      })

      if (request.verificationStatus !== 'verified') {
        await ctx.db.patch(request._id, {
          verificationStatus: 'pending',
        })
      }

      await insertRequestEvent(ctx, {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        actorType,
        actorMemberId: emailLog.createdByMemberId,
        eventType: 'verification_email_sent',
        message: 'Sent a verification email',
        details: buildEventDetails({
          delivery: 'provider',
          provider: args.providerName ?? emailLog.providerName ?? 'resend',
          senderSource: 'platform',
          fromEmail: args.fromEmail ?? emailLog.fromEmail ?? null,
          replyToEmail: args.replyToEmail ?? emailLog.replyToEmail ?? null,
          toEmail: emailLog.toEmail,
        }),
      })

      return {
        emailLogId: emailLog._id,
        outcome: 'sent' as const,
      }
    }

    const failureMessage = trimEventValue(
      args.errorMessage ?? 'Verification email delivery failed.'
    )

    await ctx.db.patch(emailLog._id, {
      status: 'failed',
      deliveryMode: 'provider',
      fromEmail: args.fromEmail ?? emailLog.fromEmail,
      replyToEmail: args.replyToEmail ?? emailLog.replyToEmail,
      senderSource: 'platform',
      providerName: args.providerName ?? emailLog.providerName,
      errorMessage: failureMessage,
      sentAt: null,
    })

    if (request.verificationStatus !== 'verified') {
      await ctx.db.patch(request._id, {
        verificationStatus: 'failed',
      })
    }

    await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      actorType,
      actorMemberId: emailLog.createdByMemberId,
      eventType: 'verification_email_failed',
      message: 'Failed to send a verification email',
      details: buildEventDetails({
        delivery: 'provider',
        provider: args.providerName ?? emailLog.providerName ?? 'resend',
        senderSource: 'platform',
        fromEmail: args.fromEmail ?? emailLog.fromEmail ?? null,
        replyToEmail: args.replyToEmail ?? emailLog.replyToEmail ?? null,
        toEmail: emailLog.toEmail,
        error: failureMessage,
      }),
    })

    return {
      emailLogId: emailLog._id,
      outcome: 'failed' as const,
    }
  },
})

export const finalizeRequestEmailDelivery = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    emailLogId: v.id('emailLogs'),
    outcome: v.union(v.literal('sent'), v.literal('failed')),
    providerName: v.optional(v.union(v.string(), v.null())),
    fromEmail: v.optional(v.union(v.string(), v.null())),
    replyToEmail: v.optional(v.union(v.string(), v.null())),
    errorMessage: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId)
    const emailLog = await ctx.db.get(args.emailLogId)

    if (
      request === null ||
      request.workspaceId !== args.workspaceId ||
      request.archivedAt !== null ||
      emailLog === null ||
      emailLog.workspaceId !== args.workspaceId ||
      emailLog.requestId !== args.requestId
    ) {
      throw new Error('Request email delivery state could not be loaded.')
    }

    if (emailLog.status !== 'queued') {
      return {
        emailLogId: emailLog._id,
        outcome: emailLog.status,
      }
    }

    const actorType = emailLog.createdByMemberId === null ? 'system' : 'member'

    if (args.outcome === 'sent') {
      await ctx.db.patch(emailLog._id, {
        status: 'sent',
        deliveryMode: 'provider',
        fromEmail: args.fromEmail ?? emailLog.fromEmail,
        replyToEmail: args.replyToEmail ?? emailLog.replyToEmail,
        senderSource: 'platform',
        providerName: args.providerName ?? emailLog.providerName,
        errorMessage: null,
        sentAt: Date.now(),
      })

      await insertRequestEvent(ctx, {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        actorType,
        actorMemberId: emailLog.createdByMemberId,
        eventType: 'request_email_sent',
        message: 'Sent a request email',
        details: buildEventDetails({
          delivery: 'provider',
          provider: args.providerName ?? emailLog.providerName ?? 'resend',
          senderSource: 'platform',
          fromEmail: args.fromEmail ?? emailLog.fromEmail ?? null,
          replyToEmail: args.replyToEmail ?? emailLog.replyToEmail ?? null,
          toEmail: emailLog.toEmail,
          template: formatTemplateKey(emailLog.templateKey),
        }),
      })

      return {
        emailLogId: emailLog._id,
        outcome: 'sent' as const,
      }
    }

    const failureMessage = trimEventValue(
      args.errorMessage ?? 'Request email delivery failed.'
    )

    await ctx.db.patch(emailLog._id, {
      status: 'failed',
      deliveryMode: 'provider',
      fromEmail: args.fromEmail ?? emailLog.fromEmail,
      replyToEmail: args.replyToEmail ?? emailLog.replyToEmail,
      senderSource: 'platform',
      providerName: args.providerName ?? emailLog.providerName,
      errorMessage: failureMessage,
      sentAt: null,
    })

    await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      actorType,
      actorMemberId: emailLog.createdByMemberId,
      eventType: 'request_email_failed',
      message: 'Failed to send a request email',
      details: buildEventDetails({
        delivery: 'provider',
        provider: args.providerName ?? emailLog.providerName ?? 'resend',
        senderSource: 'platform',
        fromEmail: args.fromEmail ?? emailLog.fromEmail ?? null,
        replyToEmail: args.replyToEmail ?? emailLog.replyToEmail ?? null,
        toEmail: emailLog.toEmail,
        template: formatTemplateKey(emailLog.templateKey),
        error: failureMessage,
      }),
    })

    return {
      emailLogId: emailLog._id,
      outcome: 'failed' as const,
    }
  },
})

export const deliverVerificationEmail = internalAction({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    tokenId: v.id('verificationTokens'),
    emailLogId: v.id('emailLogs'),
    toEmail: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const snapshot: DeliverySnapshot | null = await ctx.runQuery(
      internal.verificationDelivery.getDeliverySnapshot,
      {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        tokenId: args.tokenId,
        emailLogId: args.emailLogId,
      }
    )

    if (snapshot === null || snapshot.emailLogStatus !== 'queued') {
      return {
        status: 'skipped' as const,
      }
    }

    const attemptedDelivery = getTransactionalEmailDefaults(snapshot.supportEmail)

    try {
      const result = await sendTransactionalEmail({
        toEmail: args.toEmail,
        subject: args.subject,
        body: args.body,
        idempotencyKey: args.emailLogId,
        replyToEmail: snapshot.supportEmail,
      })

      await ctx.runMutation(internal.verificationDelivery.finalizeVerificationEmailDelivery, {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        tokenId: args.tokenId,
        emailLogId: args.emailLogId,
        outcome: 'sent',
        providerName: result.providerName,
        fromEmail: result.fromEmail,
        replyToEmail: result.replyToEmail,
      })

      return {
        status: 'sent' as const,
        providerName: result.providerName,
        senderSource: 'platform' as const,
      }
    } catch (error) {
      const errorMessage = getDeliveryErrorMessage(error)

      await ctx.runMutation(internal.verificationDelivery.finalizeVerificationEmailDelivery, {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        tokenId: args.tokenId,
        emailLogId: args.emailLogId,
        outcome: 'failed',
        providerName: attemptedDelivery.providerName,
        fromEmail: attemptedDelivery.fromEmail,
        replyToEmail: attemptedDelivery.replyToEmail,
        errorMessage,
      })

      return {
        status: 'failed' as const,
        errorMessage,
      }
    }
  },
})

export const deliverRequestEmail = internalAction({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    emailLogId: v.id('emailLogs'),
    toEmail: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const snapshot: DeliverySnapshot | null = await ctx.runQuery(
      internal.verificationDelivery.getRequestEmailDeliverySnapshot,
      {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        emailLogId: args.emailLogId,
      }
    )

    if (snapshot === null || snapshot.emailLogStatus !== 'queued') {
      return {
        status: 'skipped' as const,
      }
    }

    const attemptedDelivery = getTransactionalEmailDefaults(snapshot.supportEmail)

    try {
      const result = await sendTransactionalEmail({
        toEmail: args.toEmail,
        subject: args.subject,
        body: args.body,
        idempotencyKey: args.emailLogId,
        replyToEmail: snapshot.supportEmail,
      })

      await ctx.runMutation(internal.verificationDelivery.finalizeRequestEmailDelivery, {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        emailLogId: args.emailLogId,
        outcome: 'sent',
        providerName: result.providerName,
        fromEmail: result.fromEmail,
        replyToEmail: result.replyToEmail,
      })

      return {
        status: 'sent' as const,
        providerName: result.providerName,
        senderSource: 'platform' as const,
      }
    } catch (error) {
      const errorMessage = getDeliveryErrorMessage(error)

      await ctx.runMutation(internal.verificationDelivery.finalizeRequestEmailDelivery, {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        emailLogId: args.emailLogId,
        outcome: 'failed',
        providerName: attemptedDelivery.providerName,
        fromEmail: attemptedDelivery.fromEmail,
        replyToEmail: attemptedDelivery.replyToEmail,
        errorMessage,
      })

      return {
        status: 'failed' as const,
        errorMessage,
      }
    }
  },
})

function buildEventDetails(details: Record<string, string | null | undefined>) {
  const entries = Object.entries(details)
    .map(([key, value]) => [key, value?.trim() ?? ''] as const)
    .filter(([, value]) => value.length > 0)

  if (entries.length === 0) {
    return undefined
  }

  return Object.fromEntries(entries)
}

function getWorkspaceSupportEmail(value: string | null | undefined) {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}

function getDeliveryErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return trimEventValue(error.message)
  }

  return 'Outbound email delivery failed.'
}

function trimEventValue(value: string, maxLength = 240) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return 'Outbound email delivery failed.'
  }

  if (trimmedValue.length <= maxLength) {
    return trimmedValue
  }

  return `${trimmedValue.slice(0, maxLength - 3).trimEnd()}...`
}

function formatTemplateKey(templateKey: string | null) {
  if (templateKey === null) {
    return null
  }

  if (templateKey === 'denial_update') {
    return 'Denial / update'
  }

  return templateKey
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}
