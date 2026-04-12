const RESEND_API_BASE_URL = 'https://api.resend.com'
const RESEND_USER_AGENT = 'stauxil/0.0.1'
const DEFAULT_RESEND_REGION = 'us-east-1'

type JsonRecord = Record<string, unknown>

export type ResendDomainRecord = {
  record: string
  name: string
  type: string
  ttl: string
  status: string
  value: string
  priority: number | null
}

export type ResendDomain = {
  id: string
  name: string
  status: string
  region: string | null
  records: ResendDomainRecord[]
}

export function toStoredResendDomainRecords(records: ResendDomainRecord[]) {
  return records.map((record) => ({
    record: record.record,
    name: record.name,
    type: record.type,
    ttl: record.ttl,
    status: record.status,
    value: record.value,
    ...(record.priority === null ? {} : { priority: record.priority }),
  }))
}

export class ResendDomainError extends Error {
  statusCode: number | null

  constructor(message: string, statusCode: number | null = null) {
    super(message)
    this.name = 'ResendDomainError'
    this.statusCode = statusCode
  }
}

export function normalizeSenderDomainName(value: string) {
  return value.trim().toLowerCase().replace(/\.+$/, '')
}

export async function findResendDomainByName(domainName: string) {
  const normalizedDomainName = normalizeSenderDomainName(domainName)
  const domains = await listResendDomains()
  return domains.find((domain) => normalizeSenderDomainName(domain.name) === normalizedDomainName) ?? null
}

export async function createResendDomain(domainName: string) {
  const payload = await resendRequest('POST', '/domains', {
    name: normalizeSenderDomainName(domainName),
    region: DEFAULT_RESEND_REGION,
  })

  return readDomainPayload(payload)
}

export async function getResendDomain(domainId: string) {
  const payload = await resendRequest('GET', `/domains/${domainId}`)
  return readDomainPayload(payload)
}

export async function verifyResendDomain(domainId: string) {
  await resendRequest('POST', `/domains/${domainId}/verify`)
  return await getResendDomain(domainId)
}

async function listResendDomains() {
  const payload = await resendRequest('GET', '/domains?limit=100')
  const data = getPayloadArray(payload, 'data')

  return data.map(readDomainPayload)
}

async function resendRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: JsonRecord
): Promise<unknown> {
  const response = await fetch(`${RESEND_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      'Content-Type': 'application/json',
      'User-Agent': RESEND_USER_AGENT,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const payload = await readJsonPayload(response)
  if (!response.ok) {
    throw new ResendDomainError(formatResendErrorMessage(response.status, payload), response.status)
  }

  return payload
}

function getResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    throw new ResendDomainError('Resend domain management requires RESEND_API_KEY.')
  }

  return apiKey
}

function readDomainPayload(payload: unknown): ResendDomain {
  if (payload === null || typeof payload !== 'object') {
    throw new ResendDomainError('Resend returned an invalid domain response.')
  }

  const record = payload as JsonRecord
  const id = getPayloadString(record, 'id')
  const name = getPayloadString(record, 'name')
  const status = getPayloadString(record, 'status')

  if (!id || !name || !status) {
    throw new ResendDomainError('Resend domain response is missing required fields.')
  }

  return {
    id,
    name,
    status,
    region: getPayloadString(record, 'region'),
    records: getPayloadArray(record, 'records').map(readDomainRecord),
  }
}

function readDomainRecord(payload: unknown): ResendDomainRecord {
  if (payload === null || typeof payload !== 'object') {
    throw new ResendDomainError('Resend returned an invalid DNS record.')
  }

  const record = payload as JsonRecord
  const name = getPayloadString(record, 'name')
  const type = getPayloadString(record, 'type')
  const status = getPayloadString(record, 'status')
  const value = getPayloadString(record, 'value')

  if (!name || !type || !status || !value) {
    throw new ResendDomainError('Resend DNS record is missing required fields.')
  }

  return {
    record: getPayloadString(record, 'record') ?? type,
    name,
    type,
    ttl: getPayloadString(record, 'ttl') ?? 'Auto',
    status,
    value,
    priority: getPayloadNumber(record, 'priority'),
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

function formatResendErrorMessage(status: number, payload: unknown) {
  const providerMessage =
    getPayloadString(payload, 'message') ??
    getPayloadString(payload, 'error') ??
    getPayloadString(payload, 'name')

  if (providerMessage) {
    return `Resend returned ${status}: ${providerMessage}`
  }

  return `Resend returned ${status} while managing the sender domain.`
}

function getPayloadString(payload: unknown, key: string) {
  if (payload === null || typeof payload !== 'object') {
    return null
  }

  const value = (payload as JsonRecord)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getPayloadNumber(payload: unknown, key: string) {
  if (payload === null || typeof payload !== 'object') {
    return null
  }

  const value = (payload as JsonRecord)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getPayloadArray(payload: unknown, key: string) {
  if (payload === null || typeof payload !== 'object') {
    return []
  }

  const value = (payload as JsonRecord)[key]
  return Array.isArray(value) ? value : []
}
