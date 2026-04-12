import type { Metadata } from 'next'
import { DashboardPage } from '@/components/stauxil/dashboard-page'
import { StauxilAppShell } from '@/components/stauxil/app-shell'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Track request volume, upcoming deadlines, and recent case activity across the active workspace.',
}

export default function HomePage() {
  return (
    <StauxilAppShell>
      <DashboardPage />
    </StauxilAppShell>
  )
}
