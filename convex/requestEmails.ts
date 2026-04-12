import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireRequestAccess } from './lib/access'
import { buildRequestEmailPreview, simulateRequestTemplateDelivery } from './lib/requestEmailDelivery'
import { formatExpirationTime } from './lib/requestEmailTemplates'
import { buildVerificationUrl } from './lib/verificationEmail'
import {
  getVerificationEmailAddress,
  issueVerificationToken,
  sendVerificationEmail,
} from './verification'
import { emailTemplateKeyValidator } from './validators'

const PREVIEW_VERIFICATION_TOKEN = 'preview-token'

export const renderPreview = query({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    templateKey: emailTemplateKeyValidator,
  },
  handler: async (ctx, args) => {
    const { request, workspace } = await requireRequestAccess(ctx, args.workspaceId, args.requestId)

    const previewVerificationUrl =
      workspace.slug === undefined || workspace.slug === null
        ? 'https://example.com/request/verify?workspace=preview&token=preview-token'
        : buildVerificationUrl({
            workspaceSlug: workspace.slug,
            token: PREVIEW_VERIFICATION_TOKEN,
          })

    return await buildRequestEmailPreview(ctx, {
      workspace,
      request,
      templateKey: args.templateKey,
      extraVariables:
        args.templateKey === 'verification'
          ? {
              verificationUrl: previewVerificationUrl,
              expirationTime: formatExpirationTime(Date.now() + 60 * 60 * 1000),
            }
          : undefined,
    })
  },
})

export const sendTemplate = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    templateKey: emailTemplateKeyValidator,
  },
  handler: async (ctx, args) => {
    const { membership, request, workspace } = await requireRequestAccess(
      ctx,
      args.workspaceId,
      args.requestId
    )

    if (args.templateKey === 'verification') {
      const issuedToken = await issueVerificationToken(ctx, {
        workspace,
        request,
        email: getVerificationEmailAddress(request),
        createdByMemberId: membership._id,
        actorType: 'member',
      })

      const delivery = await sendVerificationEmail(ctx, {
        workspace,
        request,
        email: issuedToken.email,
        tokenId: issuedToken.tokenId,
        token: issuedToken.token,
        expiresAt: issuedToken.expiresAt,
        createdByMemberId: membership._id,
      })

      return {
        deliveryMode: delivery.delivery,
        emailLogId: delivery.emailLogId,
      }
    }

    const delivery = await simulateRequestTemplateDelivery(ctx, {
      workspace,
      request,
      templateKey: args.templateKey,
      createdByMemberId: membership._id,
      actorType: 'member',
      eventType: 'request_email_simulated',
      eventMessage: 'Logged a request email',
    })

    return {
      deliveryMode: delivery.deliveryMode,
      emailLogId: delivery.emailLogId,
    }
  },
})
