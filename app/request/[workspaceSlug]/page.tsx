import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicRequestForm } from '@/components/stauxil/public-request-form'
import { api } from '@/convex/_generated/api'
import { getServerConvexClient } from '@/lib/stauxil/convex-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Submit Request',
  description: 'Public request form for submitting privacy-related requests with the details needed for review.',
}

export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const convex = getServerConvexClient()
  const workspace = await convex.query(api.workspaces.getPublicIntakeWorkspace, {
    workspaceSlug,
  })

  if (workspace === null) {
    notFound()
  }

  return <PublicRequestForm workspace={workspace} />
}
