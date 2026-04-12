export const REQUEST_STATUS_VALUES = [
  'received',
  'in_progress',
  'waiting_on_requester',
  'completed',
  'rejected',
  'cancelled',
] as const

export type RequestStatus = (typeof REQUEST_STATUS_VALUES)[number]

export const ACTIVE_REQUEST_STATUS_VALUES = [
  'received',
  'in_progress',
  'waiting_on_requester',
] as const

export type ActiveRequestStatus = (typeof ACTIVE_REQUEST_STATUS_VALUES)[number]

export const CLOSED_REQUEST_STATUS_VALUES = ['completed', 'rejected', 'cancelled'] as const

export type ClosedRequestStatus = (typeof CLOSED_REQUEST_STATUS_VALUES)[number]

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  received: 'Received',
  in_progress: 'In progress',
  waiting_on_requester: 'Waiting on requester',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const VERIFICATION_STATUS_VALUES = [
  'not_required',
  'pending',
  'verified',
  'expired',
  'failed',
] as const

export type VerificationStatus = (typeof VERIFICATION_STATUS_VALUES)[number]

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  not_required: 'Not required',
  pending: 'Pending',
  verified: 'Verified',
  expired: 'Expired',
  failed: 'Failed',
}

export const REQUEST_TYPE_VALUES = [
  'access',
  'deletion',
  'correction',
  'portability',
  'objection',
  'restriction',
] as const

export type RequestType = (typeof REQUEST_TYPE_VALUES)[number]

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  access: 'Access',
  deletion: 'Deletion',
  correction: 'Correction',
  portability: 'Portability',
  objection: 'Objection',
  restriction: 'Restriction',
}

export const MEMBER_ROLE_VALUES = ['owner', 'admin', 'member'] as const

export type MemberRole = (typeof MEMBER_ROLE_VALUES)[number]

export const EMAIL_TEMPLATE_KEYS = [
  'verification',
  'acknowledgment',
  'more_information_needed',
  'completion',
  'denial_update',
] as const

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number]

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  verification: 'Verification',
  acknowledgment: 'Acknowledgment',
  more_information_needed: 'More information needed',
  completion: 'Completion',
  denial_update: 'Denial / update',
}

export const EMAIL_TEMPLATE_VARIABLES = [
  {
    key: 'requesterName',
    description: 'Best available requester display name',
  },
  {
    key: 'companyName',
    description: 'Workspace brand name shown to requesters',
  },
  {
    key: 'caseId',
    description: 'Human-readable request case ID',
  },
  {
    key: 'requestType',
    description: 'Formatted request type label',
  },
  {
    key: 'dueDate',
    description: 'Formatted request due date',
  },
  {
    key: 'requesterEmail',
    description: 'Requester email address',
  },
  {
    key: 'subjectName',
    description: 'Subject name when different from requester',
  },
  {
    key: 'subjectEmail',
    description: 'Subject email address',
  },
  {
    key: 'verificationUrl',
    description: 'Verification link for verification emails',
  },
  {
    key: 'expirationTime',
    description: 'Verification expiration timestamp',
  },
] as const

export const EMAIL_LOG_STATUS_LABELS = {
  draft: 'Draft',
  queued: 'Queued',
  sent: 'Sent',
  failed: 'Failed',
} as const

export type EmailLogStatus = keyof typeof EMAIL_LOG_STATUS_LABELS

export const EMAIL_DELIVERY_MODE_LABELS = {
  simulated: 'Logged only',
  provider: 'Provider',
} as const

export type EmailDeliveryMode = keyof typeof EMAIL_DELIVERY_MODE_LABELS

export const EMAIL_SENDER_SOURCE_LABELS = {
  platform: 'Platform sender',
  workspace: 'Workspace sender',
} as const

export type EmailSenderSource = keyof typeof EMAIL_SENDER_SOURCE_LABELS

export const EMAIL_PROVIDER_LABELS = {
  resend: 'Resend',
} as const

export type EmailProviderName = keyof typeof EMAIL_PROVIDER_LABELS

export const WORKSPACE_SENDER_STATUS_LABELS = {
  draft: 'Draft',
  not_started: 'Not started',
  pending: 'Pending',
  verified: 'Verified',
  failed: 'Failed',
  temporary_failure: 'Temporary failure',
  disabled: 'Disabled',
} as const

export type WorkspaceSenderStatus = keyof typeof WORKSPACE_SENDER_STATUS_LABELS

export const WORKSPACE_SENDER_FALLBACK_MODE_LABELS = {
  platform: 'Platform sender',
} as const

export type WorkspaceSenderFallbackMode = keyof typeof WORKSPACE_SENDER_FALLBACK_MODE_LABELS
