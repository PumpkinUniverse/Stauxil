import type { Metadata } from 'next'
import { RequestSuccessCard } from '@/components/stauxil/request-success-card'
import { api } from '@/convex/_generated/api'
import { getServerConvexClient } from '@/lib/stauxil/convex-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Request Submitted',
  description: 'Confirmation page for a submitted public request, including case reference and next steps.',
}

export default async function RequestSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; caseId?: string }>
}) {
  const { workspace, caseId } = await searchParams

  if (!workspace) {
    return (
      <RequestSuccessCard
        companyName="Stauxil"
        successMessage="The request has been received."
        caseId={caseId ?? null}
        workspaceSlug={null}
        requiresVerification={false}
        brandColor="#537dc4"
      />
    )
  }

  const convex = getServerConvexClient()
  const publicWorkspace = await convex.query(api.workspaces.getPublicIntakeWorkspace, {
    workspaceSlug: workspace,
  })

  return (
      <RequestSuccessCard
      companyName={publicWorkspace?.companyName ?? 'Stauxil'}
      successMessage={
        publicWorkspace?.successMessage ?? 'The request has been received.'
      }
      caseId={caseId ?? null}
      workspaceSlug={publicWorkspace?.workspaceSlug ?? workspace}
      requiresVerification
      supportEmail={publicWorkspace?.supportEmail ?? null}
      brandColor={publicWorkspace?.brandColor ?? '#537dc4'}
      logoUrl={publicWorkspace?.logoUrl ?? null}
    />
  )
}
