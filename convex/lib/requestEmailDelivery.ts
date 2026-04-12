import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { createEmailLogEntry } from '../emailLogs'
import { getEffectiveEmailTemplate } from '../emailTemplates'
import { insertRequestEvent } from '../requestEvents'
import { normalizeEmail } from './access'
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
}

type SimulateRequestTemplateDeliveryArgs = BuildRequestEmailPreviewArgs & {
  createdByMemberId: Id<'workspaceMembers'> | null
  actorType: 'member' | 'system'
  eventType: string
  eventMessage: string
  eventDetails?: Record<string, string>
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
    createdByMemberId: args.createdByMemberId,
  })

  return {
    ...preview,
    emailLogId,
    deliveryMode: 'provider' as const,
  }
}

export async function simulateRequestTemplateDelivery(
  ctx: MutationCtx,
  args: SimulateRequestTemplateDeliveryArgs
) {
  const preview = await buildRequestEmailPreview(ctx, args)

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
    status: 'sent',
    deliveryMode: 'simulated',
    createdByMemberId: args.createdByMemberId,
  })

  await insertRequestEvent(ctx, {
    workspaceId: args.workspace._id,
    requestId: args.request._id,
    actorType: args.actorType,
    actorMemberId: args.createdByMemberId,
    eventType: args.eventType,
    message: args.eventMessage,
    details: {
      delivery: 'logged only',
      template: preview.templateName,
      toEmail: preview.toEmail,
      ...(args.eventDetails ?? {}),
    },
  })

  return {
    ...preview,
    emailLogId,
    deliveryMode: 'simulated' as const,
  }
}
