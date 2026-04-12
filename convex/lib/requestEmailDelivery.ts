import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { createEmailLogEntry } from '../emailLogs'
import { getEffectiveEmailTemplate } from '../emailTemplates'
import { normalizeEmail } from './access'
import { getTransactionalEmailDefaults } from './emailProvider'
import {
  buildRequestTemplateVariables,
  renderTemplateContent,
  type RequestEmailTemplateKey,
} from './requestEmailTemplates'

type TemplateRenderCtx = QueryCtx | MutationCtx

type BuildRequestEmailPreviewArgs = {
  workspace: Doc<'workspaces'>
  request: Doc<'requests'>
  templateKey: RequestEmailTemplateKey
  extraVariables?: Record<string, string>
  toEmail?: string
}

type QueueRequestTemplateDeliveryArgs = BuildRequestEmailPreviewArgs & {
  createdByMemberId: Id<'workspaceMembers'> | null
  preferredReplyToEmail?: string | null
}

export async function buildRequestEmailPreview(
  ctx: TemplateRenderCtx,
  args: BuildRequestEmailPreviewArgs
) {
  const template = await getEffectiveEmailTemplate(ctx, args.workspace._id, args.templateKey)
  const variables = buildRequestTemplateVariables({
    workspace: args.workspace,
    request: args.request,
    extraVariables: args.extraVariables,
  })
  const toEmail = normalizeEmail(
    args.toEmail ?? args.request.requesterEmail ?? args.request.subjectEmail
  )

  return {
    templateId: template._id,
    templateKey: template.key,
    templateName: template.name,
    description: template.description,
    isEnabled: template.isEnabled,
    toEmail,
    subject: renderTemplateContent(template.subject, variables),
    body: renderTemplateContent(template.body, variables),
    variables,
  }
}

export async function queueRequestTemplateDelivery(
  ctx: MutationCtx,
  args: QueueRequestTemplateDeliveryArgs
) {
  const preview = await buildRequestEmailPreview(ctx, args)
  const deliveryDefaults = getTransactionalEmailDefaults(args.preferredReplyToEmail)

  if (!preview.isEnabled) {
    throw new Error('This template is disabled for the workspace.')
  }

  const emailLogId = await createEmailLogEntry(ctx, {
    workspaceId: args.workspace._id,
    requestId: args.request._id,
    templateId: preview.templateId,
    templateKey: preview.templateKey,
    toEmail: preview.toEmail,
    subject: preview.subject,
    body: preview.body,
    status: 'queued',
    deliveryMode: 'provider',
    fromEmail: deliveryDefaults.fromEmail,
    replyToEmail: deliveryDefaults.replyToEmail,
    senderSource: 'platform',
    providerName: deliveryDefaults.providerName,
    createdByMemberId: args.createdByMemberId,
  })

  return {
    ...preview,
    emailLogId,
    deliveryMode: 'provider' as const,
    fromEmail: deliveryDefaults.fromEmail,
    replyToEmail: deliveryDefaults.replyToEmail,
  }
}
