import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { queueRequestTemplateDelivery } from './requestEmailDelivery'
import { formatExpirationTime } from './requestEmailTemplates'

const VERIFICATION_TEMPLATE_KEY = 'verification'

type QueueVerificationEmailArgs = {
  workspace: Doc<'workspaces'>
  request: Doc<'requests'>
  toEmail: string
  verificationUrl: string
  expiresAt: number
  createdByMemberId: Id<'workspaceMembers'> | null
}

export async function queueVerificationEmail(
  ctx: MutationCtx,
  args: QueueVerificationEmailArgs
) {
  const delivery = await queueRequestTemplateDelivery(ctx, {
    workspace: args.workspace,
    request: args.request,
    templateKey: VERIFICATION_TEMPLATE_KEY,
    toEmail: args.toEmail,
    extraVariables: {
      verificationUrl: args.verificationUrl,
      expirationTime: formatExpirationTime(args.expiresAt),
    },
    createdByMemberId: args.createdByMemberId,
  })

  return {
    delivery: delivery.deliveryMode,
    emailLogId: delivery.emailLogId,
    toEmail: delivery.toEmail,
    subject: delivery.subject,
    body: delivery.body,
  }
}

export function buildVerificationUrl({
  workspaceSlug,
  token,
}: {
  workspaceSlug: string
  token: string
}) {
  const baseUrl = getAppBaseUrl()
  const url = new URL('/request/verify', baseUrl)
  url.searchParams.set('workspace', workspaceSlug)
  url.searchParams.set('token', token)
  return url.toString()
}

function getAppBaseUrl() {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL

  if (configuredBaseUrl) {
    const normalizedBaseUrl = configuredBaseUrl.startsWith('http')
      ? configuredBaseUrl
      : `https://${configuredBaseUrl}`
    return new URL(normalizedBaseUrl)
  }

  return new URL('http://localhost:3000')
}
