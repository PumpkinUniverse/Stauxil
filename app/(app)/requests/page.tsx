import type { Metadata } from 'next'
import { RequestsPage } from '@/components/stauxil/requests-page'

export const metadata: Metadata = {
  title: 'Requests',
  description: 'Work through the full request queue with filters, pagination, and direct case access.',
}

export default function RequestsRoute() {
  return <RequestsPage />
}
