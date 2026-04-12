import type { Metadata } from 'next'
import { GuidePage } from '@/components/stauxil/guide-page'

export const metadata: Metadata = {
  title: 'Guide',
  description:
    'Review the Stauxil app overview, setup steps, request workflow, and troubleshooting guidance for workspace owners.',
}

export default function WorkspaceGuidePage() {
  return <GuidePage />
}
