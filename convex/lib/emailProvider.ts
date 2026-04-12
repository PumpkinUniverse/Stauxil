type EmailProviderSendArgs = {
  toEmail: string
  subject: string
  body: string
  idempotencyKey: string
  sender?: {
    fromEmail?: string | null
    displayName?: string | null
    replyToEmail?: string | null
  }
}

export type EmailProviderSendResult = {
  providerName: 'resend'
  providerMessageId: string | null
  fromEmail: string
  replyToEmail: string | null
}

type EmailProvider = {
  name: 'resend'
  send: (args: EmailProviderSendArgs) => Promise<EmailProviderSendResult>
}

type ResendConfig = {
  apiKey: string
  defaultFromEmail: string
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
  const provider = getConfiguredEmailProvider()
  return await provider.send(args)
}

function getConfiguredEmailProvider(): EmailProvider {
  const providerName = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase()

  if (!providerName) {
    throw new EmailProviderConfigError(
      'Verification email delivery is not configured. Set EMAIL_PROVIDER=resend, EMAIL_FROM, and RESEND_API_KEY.'
    )
  }

  if (providerName === 'resend') {
    const config = getResendConfig()

    return {
      name: 'resend',
      send: async (args) => await sendWithResend(config, args),
    }
  }

  throw new EmailProviderConfigError(
    `Unsupported EMAIL_PROVIDER "${providerName}". Use EMAIL_PROVIDER=resend for this MVP.`
  )
}

function getResendConfig(): ResendConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.EMAIL_FROM?.trim()

  if (!apiKey || !fromEmail) {
    throw new EmailProviderConfigError(
      'Resend delivery requires both RESEND_API_KEY and EMAIL_FROM.'
    )
  }

  return {
    apiKey,
    defaultFromEmail: fromEmail,
    defaultReplyToEmail: process.env.EMAIL_REPLY_TO?.trim() || null,
  }
}

async function sendWithResend(
  config: ResendConfig,
  args: EmailProviderSendArgs
): Promise<EmailProviderSendResult> {
  const fromEmail = args.sender?.fromEmail?.trim() || config.defaultFromEmail
  const replyToEmail = args.sender?.replyToEmail?.trim() || config.defaultReplyToEmail

  const response = await fetch(RESEND_SEND_EMAIL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': args.idempotencyKey,
      'User-Agent': RESEND_USER_AGENT,
    },
    body: JSON.stringify({
      from: formatMailbox(fromEmail, args.sender?.displayName ?? null),
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

function formatMailbox(email: string, displayName: string | null | undefined) {
  const normalizedDisplayName = displayName?.trim() || ''
  if (!normalizedDisplayName) {
    return email
  }

  return `${normalizedDisplayName} <${email}>`
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

  return `Resend returned ${status} while sending the verification email.`
}

function getPayloadString(payload: unknown, key: string) {
  if (payload === null || typeof payload !== 'object') {
    return null
  }

  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
