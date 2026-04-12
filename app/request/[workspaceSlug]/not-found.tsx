import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PublicRequestNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Request form not found</CardTitle>
          <CardDescription>
            The public intake page for this workspace is not available right now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">Return to Stauxil</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
