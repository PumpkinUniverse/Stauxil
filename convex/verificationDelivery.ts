import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery, type ActionCtx } from './_generated/server'
import { EmailProviderSendError, sendTransactionalEmail } from './lib/emailProvider'
import {
  getResendDomain,
  normalizeSenderDomainName,
  toStoredResendDomainRecords,
} from './lib/resendDomains'
import { insertRequestEvent } from './requestEvents'
import { emailSenderSourceValidator } from './validators'

type SenderDeliverySnapshot = {
  workspaceName: string
  supportEmail: string | null
  sender: {
    fromEmail: string
    displayName: string | null
    status: string
    providerDomainId: string | null
    verifiedDomain: string | null
    fallbackMode: 'platform'
    failureReason: string | null
  } | null
}

type AttemptedSender = {
  senderSource: 'platform' | 'workspace'
  senderInput?: {
    fromEmail?: string | null
    displayName?: string | null
    replyToEmail?: string | null
  }
  attemptedFromEmail: string | null
  attemptedReplyToEmail: string | null
}

export const getDeliverySnapshot = internalQuery({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    tokenId: v.id('verificationTokens'),
    emailLogId: v.id('emailLogs'),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId)
    const token = await ctx.db.get(args.tokenId)
    const emailLog = await ctx.db.get(args.emailLogId)

    if (
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
    senderSource: v.optional(v.union(emailSenderSourceValidator, v.null())),
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
        senderSource: args.senderSource ?? emailLog.senderSource,
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
          provider: args.providerName ?? null,
          senderSource: args.senderSource ?? emailLog.senderSource ?? null,
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
      senderSource: args.senderSource ?? emailLog.senderSource,
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
        provider: args.providerName ?? null,
        senderSource: args.senderSource ?? emailLog.senderSource ?? null,
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
    const snapshot: { emailLogStatus: 'draft' | 'queued' | 'sent' | 'failed' } | null =
      await ctx.runQuery(internal.verificationDelivery.getDeliverySnapshot, {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        tokenId: args.tokenId,
        emailLogId: args.emailLogId,
      })

    if (snapshot === null || snapshot.emailLogStatus !== 'queued') {
      return {
        status: 'skipped' as const,
      }
    }

    const senderSnapshot: SenderDeliverySnapshot | null = await ctx.runQuery(
      internal.workspaceSenders.getWorkspaceSenderDeliverySnapshot,
      {
        workspaceId: args.workspaceId,
      }
    )

    const attemptedSender = await resolveAttemptedSender(ctx, args.workspaceId, senderSnapshot)

    try {
      const result = await sendTransactionalEmail({
        toEmail: args.toEmail,
        subject: args.subject,
        body: args.body,
        idempotencyKey: args.emailLogId,
        sender: attemptedSender.senderInput,
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
        senderSource: attemptedSender.senderSource,
      })

      return {
        status: 'sent' as const,
        providerName: result.providerName,
        senderSource: attemptedSender.senderSource,
      }
    } catch (error) {
      const errorMessage = getDeliveryErrorMessage(error)

      if (attemptedSender.senderSource === 'workspace' && shouldRetryWithPlatformSender(error)) {
        await ctx.runMutation(internal.workspaceSenders.recordWorkspaceSenderFailure, {
          workspaceId: args.workspaceId,
          status: 'temporary_failure',
          failureReason: errorMessage,
        })

        try {
          const fallbackResult = await sendTransactionalEmail({
            toEmail: args.toEmail,
            subject: args.subject,
            body: args.body,
            idempotencyKey: `${args.emailLogId}-platform-fallback`,
            sender: {
              replyToEmail: senderSnapshot?.supportEmail ?? null,
            },
          })

          await ctx.runMutation(internal.verificationDelivery.finalizeVerificationEmailDelivery, {
            workspaceId: args.workspaceId,
            requestId: args.requestId,
            tokenId: args.tokenId,
            emailLogId: args.emailLogId,
            outcome: 'sent',
            providerName: fallbackResult.providerName,
            fromEmail: fallbackResult.fromEmail,
            replyToEmail: fallbackResult.replyToEmail,
            senderSource: 'platform',
          })

          return {
            status: 'sent' as const,
            providerName: fallbackResult.providerName,
            senderSource: 'platform' as const,
          }
        } catch (fallbackError) {
          const fallbackErrorMessage = getDeliveryErrorMessage(fallbackError)

          await ctx.runMutation(internal.verificationDelivery.finalizeVerificationEmailDelivery, {
            workspaceId: args.workspaceId,
            requestId: args.requestId,
            tokenId: args.tokenId,
            emailLogId: args.emailLogId,
            outcome: 'failed',
            providerName: getProviderName(fallbackError),
            fromEmail: null,
            replyToEmail: senderSnapshot?.supportEmail ?? null,
            senderSource: 'platform',
            errorMessage: fallbackErrorMessage,
          })

          return {
            status: 'failed' as const,
            errorMessage: fallbackErrorMessage,
          }
        }
      }

      await ctx.runMutation(internal.verificationDelivery.finalizeVerificationEmailDelivery, {
        workspaceId: args.workspaceId,
        requestId: args.requestId,
        tokenId: args.tokenId,
        emailLogId: args.emailLogId,
        outcome: 'failed',
        providerName: getProviderName(error),
        fromEmail: attemptedSender.attemptedFromEmail,
        replyToEmail: attemptedSender.attemptedReplyToEmail,
        senderSource: attemptedSender.senderSource,
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

async function resolveAttemptedSender(
  ctx: ActionCtx,
  workspaceId: Id<'workspaces'>,
  senderSnapshot: SenderDeliverySnapshot | null
): Promise<AttemptedSender> {
  const platformReplyToEmail = senderSnapshot?.supportEmail ?? null
  const workspaceSender = senderSnapshot?.sender ?? null

  if (
    workspaceSender !== null &&
    workspaceSender.providerDomainId !== null &&
    shouldRefreshWorkspaceSenderBeforeSend(workspaceSender.status)
  ) {
    try {
      const domain = await getResendDomain(workspaceSender.providerDomainId)
      const mappedStatus = mapWorkspaceSenderStatus(domain.status)
      const providerFailureReason = getDomainFailureReason(domain.status)

      await ctx.runMutation(internal.workspaceSenders.syncWorkspaceSenderFromProvider, {
        workspaceId,
        providerDomainId: domain.id,
        verifiedDomain: mappedStatus === 'verified' ? domain.name : null,
        dnsRecords: toStoredResendDomainRecords(domain.records),
        status: mappedStatus,
        lastCheckedAt: Date.now(),
        verifiedAt: null,
        failureReason: providerFailureReason,
      })

      const senderDomain = getSenderDomainFromEmail(workspaceSender.fromEmail)
      const verifiedDomain = normalizeSenderDomainName(domain.name)
      if (mappedStatus === 'verified' && senderDomain === verifiedDomain) {
        return {
          senderSource: 'workspace',
          senderInput: {
            fromEmail: workspaceSender.fromEmail,
            displayName: workspaceSender.displayName,
            replyToEmail: platformReplyToEmail,
          },
          attemptedFromEmail: workspaceSender.fromEmail,
          attemptedReplyToEmail: platformReplyToEmail,
        }
      }

      if (mappedStatus === 'verified' && senderDomain !== verifiedDomain) {
        await ctx.runMutation(internal.workspaceSenders.recordWorkspaceSenderFailure, {
          workspaceId,
          status: 'temporary_failure',
          failureReason:
            'Workspace sender email must use the same root or subdomain that was verified with Resend.',
        })
      }
    } catch (error) {
      await ctx.runMutation(internal.workspaceSenders.recordWorkspaceSenderFailure, {
        workspaceId,
        status: 'temporary_failure',
        failureReason: getDeliveryErrorMessage(error),
      })
    }
  }

  return {
    senderSource: 'platform',
    senderInput: platformReplyToEmail ? { replyToEmail: platformReplyToEmail } : undefined,
    attemptedFromEmail: null,
    attemptedReplyToEmail: platformReplyToEmail,
  }
}

function getDeliveryErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return trimEventValue(error.message)
  }

  return 'Verification email delivery failed.'
}

function trimEventValue(value: string, maxLength = 240) {
  const trimmed = value.trim()

  if (!trimmed) {
    return 'Verification email delivery failed.'
  }

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`
}

function getProviderName(error: unknown) {
  if (error instanceof EmailProviderSendError) {
    return error.providerName
  }

  return null
}

function shouldRetryWithPlatformSender(error: unknown) {
  if (!(error instanceof EmailProviderSendError)) {
    return false
  }

  if (error.statusCode === 403 || error.statusCode === 422) {
    return true
  }

  return /(domain|verified|verification|sender|from address)/i.test(error.message)
}

function shouldRefreshWorkspaceSenderBeforeSend(status: string) {
  return status === 'verified' || status === 'pending' || status === 'temporary_failure'
}

function mapWorkspaceSenderStatus(providerStatus: string) {
  const normalizedStatus = providerStatus.trim().toLowerCase()

  if (normalizedStatus === 'verified') {
    return 'verified' as const
  }

  if (normalizedStatus === 'failed') {
    return 'failed' as const
  }

  if (normalizedStatus === 'temporary_failure') {
    return 'temporary_failure' as const
  }

  if (normalizedStatus === 'pending' || normalizedStatus === 'not_started') {
    return 'pending' as const
  }

  return 'pending' as const
}

function getDomainFailureReason(providerStatus: string) {
  const normalizedStatus = providerStatus.trim().toLowerCase()

  if (normalizedStatus === 'failed') {
    return 'Resend reported the workspace sender domain as failed.'
  }

  if (normalizedStatus === 'temporary_failure') {
    return 'Resend reported a temporary failure while checking the workspace sender domain.'
  }

  return null
}

function getSenderDomainFromEmail(email: string) {
  const [, domain = ''] = email.split('@')
  return normalizeSenderDomainName(domain)
}
