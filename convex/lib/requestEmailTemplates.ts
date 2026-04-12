import type { Doc } from '../_generated/dataModel'

export const REQUEST_EMAIL_TEMPLATE_KEYS = [
  'verification',
  'acknowledgment',
  'more_information_needed',
  'completion',
  'denial_update',
] as const

export type RequestEmailTemplateKey = (typeof REQUEST_EMAIL_TEMPLATE_KEYS)[number]

export const REQUEST_EMAIL_TEMPLATE_VARIABLES = [
  {
    key: 'requesterName',
    description: 'Best available requester display name.',
  },
  {
    key: 'companyName',
    description: 'Workspace brand name shown to requesters.',
  },
  {
    key: 'caseId',
    description: 'Readable case ID for the request.',
  },
  {
    key: 'requestType',
    description: 'Formatted request type label.',
  },
  {
    key: 'dueDate',
    description: 'Formatted due date or fallback operational text.',
  },
  {
    key: 'requesterEmail',
    description: 'Requester email address.',
  },
  {
    key: 'subjectName',
    description: 'Data subject name when different from requester.',
  },
  {
    key: 'subjectEmail',
    description: 'Data subject email for the request.',
  },
  {
    key: 'verificationUrl',
    description: 'Verification link used by the verification template.',
  },
  {
    key: 'expirationTime',
    description: 'Verification link expiration timestamp.',
  },
] as const

type RequestEmailTemplateDefinition = {
  key: RequestEmailTemplateKey
  name: string
  description: string
  subject: string
  body: string
  aliases: string[]
}

const REQUEST_EMAIL_TEMPLATE_DEFINITIONS: RequestEmailTemplateDefinition[] = [
  {
    key: 'verification',
    name: 'Verification',
    description:
      'Confirm requester control of the email address before the team starts fulfillment.',
    subject: 'Verify your privacy request with {{companyName}}',
    body:
      'Hello {{requesterName}},\n\nUse the link below to verify your privacy request with {{companyName}}.\n\nCase ID: {{caseId}}\nRequest type: {{requestType}}\nVerification link: {{verificationUrl}}\n\nThis link expires {{expirationTime}}.\n\nIf you did not submit this request, you can ignore this email.',
    aliases: ['verification_link'],
  },
  {
    key: 'acknowledgment',
    name: 'Acknowledgment',
    description: 'Confirm the request is in the team queue with timing context.',
    subject: 'We received request {{caseId}}',
    body:
      'Hello {{requesterName}},\n\n{{companyName}} received your {{requestType}} request.\n\nCase ID: {{caseId}}\nTarget due date: {{dueDate}}\n\nWe will share updates by email as work continues.',
    aliases: ['request_received'],
  },
  {
    key: 'more_information_needed',
    name: 'More information needed',
    description: 'Ask the requester for the next detail needed to continue work.',
    subject: 'More information needed for request {{caseId}}',
    body:
      'Hello {{requesterName}},\n\nWe need one more detail before {{companyName}} can continue request {{caseId}}.\n\nRequest type: {{requestType}}\nCurrent due date: {{dueDate}}\n\nReply to this email with the missing information and we will keep the request moving.',
    aliases: [],
  },
  {
    key: 'completion',
    name: 'Completion',
    description: 'Share that the operational work for the request is complete.',
    subject: 'Request {{caseId}} is complete',
    body:
      'Hello {{requesterName}},\n\n{{companyName}} completed work on request {{caseId}}.\n\nRequest type: {{requestType}}\nIf you need anything else, reply to this email and our team can follow up.',
    aliases: ['request_completed'],
  },
  {
    key: 'denial_update',
    name: 'Denial / update',
    description: 'Send a denial outcome or another important request update.',
    subject: 'Update for request {{caseId}}',
    body:
      'Hello {{requesterName}},\n\n{{companyName}} has an update for request {{caseId}}.\n\nRequest type: {{requestType}}\nCurrent due date: {{dueDate}}\n\nReply to this email if you need clarification or next steps.',
    aliases: [],
  },
] as const

const REQUEST_EMAIL_TEMPLATE_DEFINITION_MAP = new Map(
  REQUEST_EMAIL_TEMPLATE_DEFINITIONS.map((definition) => [definition.key, definition] as const)
)

export function isRequestEmailTemplateKey(value: string): value is RequestEmailTemplateKey {
  return REQUEST_EMAIL_TEMPLATE_DEFINITION_MAP.has(value as RequestEmailTemplateKey)
}

export function getRequestEmailTemplateDefinition(key: RequestEmailTemplateKey) {
  return REQUEST_EMAIL_TEMPLATE_DEFINITION_MAP.get(key) ?? REQUEST_EMAIL_TEMPLATE_DEFINITIONS[0]
}

export function getRequestEmailTemplateAliases(key: RequestEmailTemplateKey) {
  return [...getRequestEmailTemplateDefinition(key).aliases]
}

export function renderTemplateContent(template: string, variables: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z0-9]+)\s*}}/g, (_, key: string) => variables[key] ?? '')
}

export function buildRequestTemplateVariables(args: {
  workspace: Doc<'workspaces'>
  request: Doc<'requests'>
  extraVariables?: Record<string, string>
}) {
  const companyName = args.workspace.publicBrandName?.trim() || args.workspace.name
  const requesterName =
    args.request.requesterName?.trim() ||
    args.request.subjectName?.trim() ||
    args.request.requesterEmail?.trim() ||
    args.request.subjectEmail

  return {
    requesterName,
    companyName,
    caseId: args.request.caseId ?? '',
    requestType: formatRequestTypeLabel(args.request.requestType),
    dueDate: formatDueDate(args.request.dueAt),
    requesterEmail: args.request.requesterEmail ?? args.request.subjectEmail,
    subjectName: args.request.subjectName?.trim() || requesterName,
    subjectEmail: args.request.subjectEmail,
    verificationUrl: '',
    expirationTime: '',
    ...(args.extraVariables ?? {}),
  }
}

export function formatDueDate(timestamp: number | null) {
  if (timestamp === null) {
    return 'No due date assigned'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(timestamp)
}

export function formatExpirationTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(timestamp)
}

function formatRequestTypeLabel(value: Doc<'requests'>['requestType']) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
