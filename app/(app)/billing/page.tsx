import type { Metadata } from 'next'
import { BillingPage } from '@/components/stauxil/billing-page'

export const metadata: Metadata = {
  title: 'Billing',
  description: 'Review workspace plan usage, request limits, exports, and upgrade options.',
}

export default function WorkspaceBillingPage() {
  return <BillingPage />
}
