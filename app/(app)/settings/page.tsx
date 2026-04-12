import type { Metadata } from 'next'
import { WorkspaceSettingsPage } from '@/components/stauxil/workspace-settings-page'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage workspace branding, support details, intake defaults, and allowed request types.',
}

export default function SettingsPage() {
  return <WorkspaceSettingsPage />
}
