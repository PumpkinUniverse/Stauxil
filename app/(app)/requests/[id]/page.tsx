import type { Metadata } from 'next'
import { RequestDetailPage } from '@/components/stauxil/request-detail-page'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  return {
    title: `Request ${id}`,
    description: 'Review request status, verification, notes, email activity, and request history.',
  }
}

export default async function RequestDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <RequestDetailPage caseId={id} />
}
