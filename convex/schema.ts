import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  emailDeliveryModeValidator,
  emailProviderValidator,
  emailSenderSourceValidator,
  emailLogStatusValidator,
  memberRoleValidator,
  nullableNumberValidator,
  nullableStringValidator,
  requestStatusValidator,
  requestTypeValidator,
  verificationStatusValidator,
  workspacePlanValidator,
  workspaceSenderFallbackModeValidator,
  workspaceSenderStatusValidator,
} from './validators'

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    slug: v.optional(v.string()),
    publicBrandName: v.optional(nullableStringValidator),
    publicIntakeIntro: v.optional(nullableStringValidator),
    publicIntakeSuccessMessage: v.optional(nullableStringValidator),
    allowedPublicRequestTypes: v.optional(v.array(requestTypeValidator)),
    supportEmail: v.optional(nullableStringValidator),
    timezone: v.optional(v.string()),
    defaultSlaDays: v.optional(v.number()),
    brandColor: v.optional(v.string()),
    logoUrl: v.optional(nullableStringValidator),
    plan: v.optional(workspacePlanValidator),
    publicRequestInitialStatus: v.optional(requestStatusValidator),
    createdByTokenIdentifier: v.string(),
    createdByEmail: nullableStringValidator,
    isPersonal: v.boolean(),
    archivedAt: nullableNumberValidator,
  })
    .index('by_created_by_token_identifier', ['createdByTokenIdentifier'])
    .index('by_slug', ['slug']),

  workspaceMembers: defineTable({
    workspaceId: v.id('workspaces'),
    tokenIdentifier: v.string(),
    email: nullableStringValidator,
    name: nullableStringValidator,
    role: memberRoleValidator,
  })
    .index('by_workspace_id', ['workspaceId'])
    .index('by_workspace_id_and_token_identifier', ['workspaceId', 'tokenIdentifier'])
    .index('by_token_identifier_and_workspace_id', ['tokenIdentifier', 'workspaceId']),

  workspaceSenders: defineTable({
    workspaceId: v.id('workspaces'),
    provider: emailProviderValidator,
    fromEmail: v.string(),
    displayName: nullableStringValidator,
    status: workspaceSenderStatusValidator,
    providerDomainId: nullableStringValidator,
    verifiedDomain: nullableStringValidator,
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
    fallbackMode: workspaceSenderFallbackModeValidator,
    lastCheckedAt: nullableNumberValidator,
    verifiedAt: nullableNumberValidator,
    failureReason: nullableStringValidator,
  }).index('by_workspace_id', ['workspaceId']),

  requests: defineTable({
    workspaceId: v.id('workspaces'),
    caseId: v.optional(v.string()),
    requestType: requestTypeValidator,
    status: requestStatusValidator,
    verificationStatus: verificationStatusValidator,
    title: v.string(),
    description: nullableStringValidator,
    jurisdiction: v.optional(nullableStringValidator),
    accountReference: v.optional(nullableStringValidator),
    subjectEmail: v.string(),
    subjectName: nullableStringValidator,
    requesterEmail: nullableStringValidator,
    requesterName: nullableStringValidator,
    dueAt: nullableNumberValidator,
    submittedAt: v.number(),
    verifiedAt: nullableNumberValidator,
    lastEventAt: v.number(),
    createdByMemberId: v.union(v.id('workspaceMembers'), v.null()),
    assignedMemberId: v.union(v.id('workspaceMembers'), v.null()),
    completedAt: nullableNumberValidator,
    archivedAt: nullableNumberValidator,
  })
    .index('by_workspace_id', ['workspaceId'])
    .index('by_workspace_id_and_case_id', ['workspaceId', 'caseId'])
    .index('by_workspace_id_and_status', ['workspaceId', 'status'])
    .index('by_workspace_id_and_status_and_last_event_at', ['workspaceId', 'status', 'lastEventAt'])
    .index('by_workspace_id_and_verification_status', ['workspaceId', 'verificationStatus'])
    .index('by_workspace_id_and_submitted_at', ['workspaceId', 'submittedAt'])
    .index('by_workspace_id_and_due_at', ['workspaceId', 'dueAt'])
    .index('by_workspace_id_and_last_event_at', ['workspaceId', 'lastEventAt'])
    .index('by_workspace_id_and_subject_email', ['workspaceId', 'subjectEmail'])
    .index('by_workspace_id_and_request_type_and_last_event_at', [
      'workspaceId',
      'requestType',
      'lastEventAt',
    ])
    .index('by_workspace_id_and_assigned_member_id_and_last_event_at', [
      'workspaceId',
      'assignedMemberId',
      'lastEventAt',
    ])
    .index('by_workspace_id_and_requester_email', ['workspaceId', 'requesterEmail']),

  requestEvents: defineTable({
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    actorType: v.string(),
    actorMemberId: v.union(v.id('workspaceMembers'), v.null()),
    eventType: v.string(),
    message: nullableStringValidator,
    details: v.optional(v.record(v.string(), v.string())),
  }).index('by_workspace_id_and_request_id', ['workspaceId', 'requestId']),

  requestNotes: defineTable({
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    authorMemberId: v.id('workspaceMembers'),
    body: v.string(),
    isInternal: v.boolean(),
  }).index('by_workspace_id_and_request_id', ['workspaceId', 'requestId']),

  emailTemplates: defineTable({
    workspaceId: v.id('workspaces'),
    key: v.string(),
    name: v.string(),
    description: nullableStringValidator,
    subject: v.string(),
    body: v.string(),
    isSystem: v.boolean(),
    isEnabled: v.boolean(),
  })
    .index('by_workspace_id', ['workspaceId'])
    .index('by_workspace_id_and_key', ['workspaceId', 'key']),

  emailLogs: defineTable({
    workspaceId: v.id('workspaces'),
    requestId: v.union(v.id('requests'), v.null()),
    templateId: v.union(v.id('emailTemplates'), v.null()),
    templateKey: nullableStringValidator,
    toEmail: v.string(),
    subject: v.string(),
    body: v.string(),
    status: emailLogStatusValidator,
    deliveryMode: v.optional(emailDeliveryModeValidator),
    fromEmail: v.optional(nullableStringValidator),
    replyToEmail: v.optional(nullableStringValidator),
    senderSource: v.optional(emailSenderSourceValidator),
    providerName: v.optional(nullableStringValidator),
    errorMessage: nullableStringValidator,
    sentAt: nullableNumberValidator,
    createdByMemberId: v.union(v.id('workspaceMembers'), v.null()),
  })
    .index('by_workspace_id', ['workspaceId'])
    .index('by_workspace_id_and_request_id', ['workspaceId', 'requestId']),

  verificationTokens: defineTable({
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    email: v.string(),
    tokenHash: v.string(),
    status: verificationStatusValidator,
    expiresAt: v.number(),
    consumedAt: nullableNumberValidator,
    lastSentAt: nullableNumberValidator,
    attemptCount: v.number(),
    createdByMemberId: v.union(v.id('workspaceMembers'), v.null()),
  })
    .index('by_workspace_id_and_request_id', ['workspaceId', 'requestId'])
    .index('by_workspace_id_and_email', ['workspaceId', 'email'])
    .index('by_workspace_id_and_token_hash', ['workspaceId', 'tokenHash'])
    .index('by_workspace_id_and_request_id_and_token_hash', [
      'workspaceId',
      'requestId',
      'tokenHash',
    ]),

  attachments: defineTable({
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    storageId: v.id('_storage'),
    fileName: v.string(),
    contentType: nullableStringValidator,
    byteSize: v.number(),
    uploadedByMemberId: v.union(v.id('workspaceMembers'), v.null()),
  }).index('by_workspace_id_and_request_id', ['workspaceId', 'requestId']),
})
