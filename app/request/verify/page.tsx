import type { Metadata } from 'next'
import { PublicRequestVerification } from '@/components/stauxil/public-request-verification'
import { api } from '@/convex/_generated/api'
import { getServerConvexClient } from '@/lib/stauxil/convex-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Request Verification',
  description: 'Confirm a requester email before request work continues in the workspace.',
}

export default async function RequestVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; token?: string }>
}) {
  const { workspace, token } = await searchParams
  const convex = getServerConvexClient()
  const publicWorkspace = workspace
    ? await convex.query(api.workspaces.getPublicIntakeWorkspace, {
        workspaceSlug: workspace,
      })
    : null

  return (
    <PublicRequestVerification
      workspaceSlug={publicWorkspace?.workspaceSlug ?? workspace ?? null}
      token={token ?? null}
      companyName={publicWorkspace?.companyName ?? 'Stauxil'}
      supportEmail={publicWorkspace?.supportEmail ?? null}
      brandColor={publicWorkspace?.brandColor ?? '#537dc4'}
      logoUrl={publicWorkspace?.logoUrl ?? null}
    />
  )
}
