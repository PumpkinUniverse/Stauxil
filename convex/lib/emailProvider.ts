type EmailProviderSendArgs = {
  toEmail: string
  subject: string
  body: string
  idempotencyKey: string
  replyToEmail?: string | null
}

export type EmailProviderSendResult = {
  providerName: 'resend'
  providerMessageId: string | null
  fromEmail: string
  replyToEmail: string | null
}

export type TransactionalEmailDefaults = {
  providerName: 'resend'
  fromEmail: string | null
  replyToEmail: string | null
}

type ResendConfig = {
  apiKey: string
  fromEmail: string
  defaultReplyToEmail: string | null
}

const RESEND_SEND_EMAIL_URL = 'https://api.resend.com/emails'
const RESEND_USER_AGENT = 'stauxil/0.0.1'

export class EmailProviderConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailProviderConfigError'
  }
}

export class EmailProviderSendError extends Error {
  providerName: 'resend'
  statusCode: number | null

  constructor(message: string, statusCode: number | null = null) {
    super(message)
    this.name = 'EmailProviderSendError'
    this.providerName = 'resend'
    this.statusCode = statusCode
  }
}

export async function sendTransactionalEmail(
  args: EmailProviderSendArgs
): Promise<EmailProviderSendResult> {
  const config = getResendConfig()
  return await sendWithResend(config, args)
}

export function getTransactionalEmailDefaults(
  preferredReplyToEmail?: string | null
): TransactionalEmailDefaults {
  const defaultReplyToEmail = normalizeOptionalValue(process.env.EMAIL_REPLY_TO)
  const requestedReplyToEmail = normalizeOptionalValue(preferredReplyToEmail)

  return {
    providerName: 'resend',
    fromEmail: normalizeOptionalValue(process.env.EMAIL_FROM),
    replyToEmail: requestedReplyToEmail ?? defaultReplyToEmail,
  }
}

function getResendConfig(): ResendConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = normalizeOptionalValue(process.env.EMAIL_FROM)

  if (!apiKey || !fromEmail) {
    throw new EmailProviderConfigError(
      'Outbound email delivery requires both RESEND_API_KEY and EMAIL_FROM. The Vercel Resend integration provides RESEND_API_KEY, but EMAIL_FROM still needs to be set manually. For local testing, you can use onboarding@resend.dev until your sending domain is verified.'
    )
  }

  return {
    apiKey,
    fromEmail,
    defaultReplyToEmail: normalizeOptionalValue(process.env.EMAIL_REPLY_TO),
  }
}

async function sendWithResend(
  config: ResendConfig,
  args: EmailProviderSendArgs
): Promise<EmailProviderSendResult> {
  const defaults = getTransactionalEmailDefaults(args.replyToEmail)
  const fromEmail = config.fromEmail
  const replyToEmail = defaults.replyToEmail ?? config.defaultReplyToEmail

  const response = await fetch(RESEND_SEND_EMAIL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': args.idempotencyKey,
      'User-Agent': RESEND_USER_AGENT,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [args.toEmail],
      subject: args.subject,
      text: args.body,
      ...(replyToEmail ? { reply_to: replyToEmail } : {}),
    }),
  })

  const payload = await readJsonPayload(response)

  if (!response.ok) {
    throw new EmailProviderSendError(formatProviderErrorMessage(response.status, payload), response.status)
  }

  return {
    providerName: 'resend',
    providerMessageId: getPayloadString(payload, 'id'),
    fromEmail,
    replyToEmail,
  }
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.toLowerCase().includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

function formatProviderErrorMessage(status: number, payload: unknown) {
  const providerMessage =
    getPayloadString(payload, 'message') ??
    getPayloadString(payload, 'error') ??
    getPayloadString(payload, 'name')

  if (providerMessage) {
    return `Resend returned ${status}: ${providerMessage}`
  }

  return `Resend returned ${status} while sending the email.`
}

function getPayloadString(payload: unknown, key: string) {
  if (payload === null || typeof payload !== 'object') {
    return null
  }

  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeOptionalValue(value: string | null | undefined) {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}
