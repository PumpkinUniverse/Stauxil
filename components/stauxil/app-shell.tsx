'use client'

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignInButton, UserButton } from '@clerk/nextjs'
import { Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react'
import {
  Building2,
  BookOpen,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type ActiveWorkspaceContextValue = {
  workspaceId: Id<'workspaces'>
  workspaceName: string
  publicFormPath: string | null
  workspaceCount: number
  membershipRole: string
  isPersonal: boolean
}

const ActiveWorkspaceContext = createContext<ActiveWorkspaceContextValue | null>(null)

const navigationItems = [
  {
    href: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/guide',
    label: 'Guide',
    icon: BookOpen,
  },
  {
    href: '/requests',
    label: 'Requests',
    icon: FileText,
  },
  {
    href: '/templates',
    label: 'Templates',
    icon: FileText,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
  },
  {
    href: '/billing',
    label: 'Billing',
    icon: CreditCard,
  },
] as const

const pageCopy: Record<
  string,
  {
    eyebrow: string
    title: string
    description: string
  }
> = {
  '/': {
    eyebrow: 'Dashboard',
    title: 'Stauxil operations dashboard',
    description:
      'Track privacy requests, stay ahead of due dates, and keep the request queue visible for the whole team.',
  },
  '/requests': {
    eyebrow: 'Requests',
    title: 'Request queue',
    description:
      'Review recent request activity, filter the queue, and open a case for ownership, deadlines, and follow-up.',
  },
  '/guide': {
    eyebrow: 'Guide',
    title: 'App overview and usage guide',
    description:
      'Review the documented Stauxil workflow, setup sequence, and operational tips for workspace owners.',
  },
  '/templates': {
    eyebrow: 'Templates',
    title: 'Templates',
    description:
      'Manage workspace email templates, keep placeholders consistent, and prepare request-specific previews before sending.',
  },
  '/settings': {
    eyebrow: 'Settings',
    title: 'Workspace settings',
    description:
      'Manage workspace branding, public intake defaults, support contact details, and request-type availability.',
  },
  '/billing': {
    eyebrow: 'Billing',
    title: 'Billing overview',
    description:
      'Review workspace plan limits, see current usage, and open hosted pricing when you need more capacity.',
  },
}

export function useActiveWorkspace() {
  const value = useContext(ActiveWorkspaceContext)

  if (value === null) {
    throw new Error('useActiveWorkspace must be used inside StauxilAppShell')
  }

  return value
}

export function StauxilAppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Authenticated>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </Authenticated>
      <Unauthenticated>
        <UnauthenticatedShell />
      </Unauthenticated>
    </>
  )
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const workspaces = useQuery(api.workspaces.listForCurrentUser, {})
  const bootstrapDefaultWorkspace = useMutation(api.workspaces.bootstrapDefaultWorkspace)
  const ensureWorkspaceSlug = useMutation(api.workspaces.ensureWorkspaceSlug)
  const startedBootstrapRef = useRef(false)
  const startedSlugRepairRef = useRef(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  useEffect(() => {
    if (workspaces === undefined || workspaces.length > 0 || startedBootstrapRef.current) {
      return
    }

    startedBootstrapRef.current = true
    void bootstrapDefaultWorkspace({}).catch((error) => {
      startedBootstrapRef.current = false
      setBootstrapError(getUserFacingErrorMessage(error))
    })
  }, [bootstrapDefaultWorkspace, workspaces])

  useEffect(() => {
    if (workspaces === undefined || workspaces.length === 0) {
      startedSlugRepairRef.current = false
      return
    }

    const activeWorkspace = workspaces[0]?.workspace
    if (!activeWorkspace || activeWorkspace.slug || startedSlugRepairRef.current) {
      if (activeWorkspace?.slug) {
        startedSlugRepairRef.current = false
      }
      return
    }

    startedSlugRepairRef.current = true
    void ensureWorkspaceSlug({ workspaceId: activeWorkspace._id }).catch(() => {
      startedSlugRepairRef.current = false
    })
  }, [ensureWorkspaceSlug, workspaces])

  const pageContent = getPageContent(pathname)

  if (workspaces === undefined) {
    return <ShellLoadingState />
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Preparing workspace
            </Badge>
            <CardTitle>Creating your Stauxil workspace</CardTitle>
            <CardDescription>
              We&apos;re setting up your first workspace so you can start managing privacy
              requests right away.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-10 w-full" />
              {bootstrapError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <p>{bootstrapError}</p>
                  <Button
                    variant="outline"
                    className="mt-3 w-full sm:w-fit"
                    onClick={() => {
                      startedBootstrapRef.current = false
                      setBootstrapError(null)
                    }}
                  >
                    Retry workspace setup
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeWorkspace = workspaces[0]
  const contextValue: ActiveWorkspaceContextValue = {
    workspaceId: activeWorkspace.workspace._id,
    workspaceName: activeWorkspace.workspace.name,
    publicFormPath: activeWorkspace.workspace.slug ? `/request/${activeWorkspace.workspace.slug}` : null,
    workspaceCount: workspaces.length,
    membershipRole: activeWorkspace.membership.role,
    isPersonal: activeWorkspace.workspace.isPersonal,
  }

  return (
    <ActiveWorkspaceContext.Provider value={contextValue}>
      <div className="min-h-screen bg-muted/30">
        <div className="mx-auto grid min-h-screen w-full max-w-screen-2xl md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden border-r border-border bg-background md:flex md:flex-col">
            <div className="flex flex-col gap-6 px-5 py-6">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ShieldCheck />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-semibold">Stauxil</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Privacy request operations
                  </span>
                </div>
              </Link>

              <Card className="border-border/70 bg-muted/40 shadow-none">
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-background text-muted-foreground">
                      <Building2 />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{contextValue.workspaceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {contextValue.isPersonal ? 'Personal workspace' : 'Shared workspace'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {contextValue.membershipRole}
                    </Badge>
                    <Badge variant="outline">
                      {contextValue.workspaceCount}{' '}
                      {contextValue.workspaceCount === 1 ? 'workspace' : 'workspaces'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <nav className="flex flex-col gap-1">
                {navigationItems.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname === item.href || pathname.startsWith(`${item.href}/`)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <item.icon />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          <div className="flex min-h-screen flex-col">
            <header className="border-b border-border bg-background/95 backdrop-blur">
              <div className="flex flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {pageContent.eyebrow}
                    </span>
                    <div className="flex flex-col gap-2">
                      <h1 className="text-2xl font-semibold tracking-tight">{pageContent.title}</h1>
                      <p className="max-w-3xl text-sm text-muted-foreground">
                        {pageContent.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <UserButton />
                  </div>
                </div>

                <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden">
                  {navigationItems.map((item) => {
                    const isActive =
                      item.href === '/'
                        ? pathname === '/'
                        : pathname === item.href || pathname.startsWith(`${item.href}/`)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <item.icon />
                        {item.label}
                      </Link>
                    )
                  })}
                </nav>
              </div>
            </header>

            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </div>
    </ActiveWorkspaceContext.Provider>
  )
}

function getPageContent(pathname: string) {
  if (pathname.startsWith('/requests/')) {
    return {
      eyebrow: 'Request details',
      title: 'Request operations',
      description:
        'Review requester context, verification state, owner assignment, deadlines, and logged activity for a single case.',
    }
  }

  return pageCopy[pathname] ?? pageCopy['/']
}

function ShellLoadingState() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto grid min-h-screen w-full max-w-screen-2xl md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-background md:flex md:flex-col">
          <div className="flex flex-col gap-5 px-5 py-6">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </aside>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-border bg-background px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-4 w-full max-w-3xl" />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="flex flex-col gap-3 p-6">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function UnauthenticatedShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            Stauxil
          </Badge>
          <CardTitle>Sign in to Stauxil</CardTitle>
          <CardDescription>
            Access the operational workspace for privacy requests, verification steps, and audit
            history.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Sign in to review requests, update templates, manage workspace settings, and check
            billing for the current workspace.
          </p>
          <SignInButton mode="modal">
            <Button className="w-full sm:w-fit">Open Stauxil</Button>
          </SignInButton>
        </CardContent>
      </Card>
    </div>
  )
}

function getUserFacingErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Unable to prepare your workspace right now.'
}
