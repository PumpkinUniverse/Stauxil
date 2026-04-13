export type ExportRow = {
  caseId: string
  title: string
  requesterLabel: string
  requesterEmail: string
  requestTypeLabel: string
  statusLabel: string
  verificationStatusLabel: string
  dueAt: number | null
  createdAt: number
  closedAt: number | null
  notesSummary: string | null
  emailSummary: string | null
  timelineSummary: string | null
}

const CSV_FORMULA_PREFIX_PATTERN = /^[=+\-@]/

export function buildRequestsCsv(rows: ExportRow[]) {
  const header = [
    'Case ID',
    'Title',
    'Requester',
    'Requester Email',
    'Request Type',
    'Status',
    'Verification Status',
    'Due Date',
    'Created At',
    'Closed At',
    'Notes Summary',
    'Email Summary',
    'Timeline Summary',
  ]

  return [
    header.map(escapeCsvValue).join(','),
    ...rows.map((row) =>
      [
        row.caseId,
        row.title,
        row.requesterLabel,
        row.requesterEmail,
        row.requestTypeLabel,
        row.statusLabel,
        row.verificationStatusLabel,
        formatDateValue(row.dueAt, 'date'),
        formatDateValue(row.createdAt, 'dateTime'),
        formatDateValue(row.closedAt, 'dateTime'),
        row.notesSummary ?? '',
        row.emailSummary ?? '',
        row.timelineSummary ?? '',
      ]
        .map(escapeCsvValue)
        .join(',')
    ),
  ].join('\r\n')
}

export function buildRequestsExportFilename(workspaceName: string, exportedAt: number) {
  const sanitizedWorkspaceName = workspaceName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const dateSegment = new Date(exportedAt).toISOString().slice(0, 10)
  const workspaceSegment = sanitizedWorkspaceName || 'workspace'

  return `stauxil-${workspaceSegment}-requests-${dateSegment}.csv`
}

export function escapeCsvValue(value: string) {
  const normalized = normalizeCsvCellValue(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

function formatDateValue(value: number | null, mode: 'date' | 'dateTime') {
  if (value === null) {
    return ''
  }

  const isoValue = new Date(value).toISOString()
  return mode === 'date' ? isoValue.slice(0, 10) : isoValue
}

function normalizeCsvCellValue(value: string) {
  const normalizedValue = value.replace(/\r?\n/g, ' ').trim()

  if (!normalizedValue) {
    return ''
  }

  if (CSV_FORMULA_PREFIX_PATTERN.test(normalizedValue)) {
    return `'${normalizedValue}`
  }

  return normalizedValue
}
