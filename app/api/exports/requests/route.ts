import type { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import {
  buildRequestsCsv,
  buildRequestsExportFilename,
} from '@/lib/stauxil/request-export-csv'
import { getConvexServerAuth } from '@/lib/stauxil/server-auth'

export const dynamic = 'force-dynamic'

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
        'Content-Disposition': `attachment; filename="${buildRequestsExportFilename(
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
