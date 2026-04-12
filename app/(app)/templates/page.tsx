import type { Metadata } from 'next'
import { TemplatesPageClient } from '@/components/stauxil/templates-page-client'

export const metadata: Metadata = {
  title: 'Templates',
  description: 'Maintain workspace email templates and placeholder content for request communication.',
}

export default function TemplatesPage() {
  return <TemplatesPageClient />
}
