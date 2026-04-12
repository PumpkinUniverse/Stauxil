import type { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import { getConvexServerAuth } from '@/lib/stauxil/server-auth'

export const dynamic = 'force-dynamic'

type ExportRow = {
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

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId')?.trim()

  if (!workspaceId) {
    return new Response('Missing workspaceId query parameter.', {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }

  const { clerkAuth, token } = await getConvexServerAuth()

  if (!clerkAuth.userId || !token) {
    return new Response('Unauthorized.', {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }

  try {
    const exportData = await fetchQuery(
      api.requests.exportByWorkspace,
      { workspaceId: workspaceId as Id<'workspaces'> },
      { token }
    )

    return new Response(`\uFEFF${buildRequestsCsv(exportData.rows)}`, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${buildFilename(
          exportData.workspaceName,
          exportData.exportedAt
        )}"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Unable to generate the request export right now.'
    const status =
      message === 'Workspace not found' ? 404 : message.includes('Upgrade to') ? 403 : 500

    return new Response(message, {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }
}

function buildRequestsCsv(rows: ExportRow[]) {
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

function escapeCsvValue(value: string) {
  const normalized = value.replace(/\r?\n/g, ' ').trim()
  return `"${normalized.replace(/"/g, '""')}"`
}

function formatDateValue(value: number | null, mode: 'date' | 'dateTime') {
  if (value === null) {
    return ''
  }

  const isoValue = new Date(value).toISOString()
  return mode === 'date' ? isoValue.slice(0, 10) : isoValue
}

function buildFilename(workspaceName: string, exportedAt: number) {
  const sanitizedWorkspaceName = workspaceName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const dateSegment = new Date(exportedAt).toISOString().slice(0, 10)
  const workspaceSegment = sanitizedWorkspaceName || 'workspace'

  return `stauxil-${workspaceSegment}-requests-${dateSegment}.csv`
}
