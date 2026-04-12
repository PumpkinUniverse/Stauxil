'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RequestPrintActions() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer />
      Print summary
    </Button>
  )
}
