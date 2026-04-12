'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { CheckCircle2, Clock3, Link2Off, RotateCcw, ShieldCheck } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getBrandBackground,
  getBrandButtonStyle,
  getBrandIconStyle,
} from '@/lib/stauxil/branding'

type VerificationState =
  | {
      kind: 'pending'
      companyName: string
      workspaceSlug: string | null
    }
  | {
      kind: 'verified'
      companyName: string
      workspaceSlug: string | null
      caseId: string | null
    }
  | {
      kind: 'expired' | 'invalid'
      companyName: string
      workspaceSlug: string | null
      caseId: string | null
    }

export function PublicRequestVerification({
  workspaceSlug,
  token,
  companyName,
  supportEmail,
  brandColor,
  logoUrl,
}: {
  workspaceSlug: string | null
  token: string | null
  companyName: string
  supportEmail: string | null
  brandColor: string
  logoUrl: string | null
}) {
  const verifyPublicToken = useMutation(api.verification.verifyPublicToken)
  const startedRef = useRef(false)
  const [isLogoVisible, setIsLogoVisible] = useState(Boolean(logoUrl))
  const [state, setState] = useState<VerificationState>(() =>
    !workspaceSlug || !token
      ? {
          kind: 'invalid',
          companyName,
          workspaceSlug,
          caseId: null,
        }
      : {
          kind: 'pending',
          companyName,
          workspaceSlug,
        }
  )

  useEffect(() => {
    if (startedRef.current || !workspaceSlug || !token) {
      return
    }

    startedRef.current = true

    let cancelled = false

    void (async () => {
      try {
        const result = await verifyPublicToken({
          workspaceSlug,
          token,
        })

        if (cancelled) {
          return
        }

        setState({
          kind: result.status,
          companyName: result.companyName,
          workspaceSlug: result.workspaceSlug ?? workspaceSlug,
          caseId: result.caseId,
        })
      } catch {
        if (cancelled) {
          return
        }

        setState({
          kind: 'invalid',
          companyName,
          workspaceSlug,
          caseId: null,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [companyName, token, verifyPublicToken, workspaceSlug])

  const viewModel =
    state.kind === 'pending'
      ? {
          badgeLabel: 'Verification pending',
          title: 'Verifying your request',
          description: 'We are checking the link and confirming the request now.',
          icon: Clock3,
          iconClassName: 'bg-amber-500/10 text-amber-700',
        }
      : state.kind === 'verified'
        ? {
            badgeLabel: 'Verified',
            title: 'Request verified',
            description:
              'The request email has been confirmed and the case is ready for the team to continue.',
            icon: CheckCircle2,
            iconClassName: 'bg-emerald-500/10 text-emerald-700',
          }
        : {
            badgeLabel: state.kind === 'expired' ? 'Link expired' : 'Invalid link',
            title: state.kind === 'expired' ? 'This link has expired' : 'This link is not valid',
            description:
              state.kind === 'expired'
                ? 'Verification links can only be used for a limited time. Submit a new request or ask the team to send a fresh link.'
                : 'The verification link could not be used. Make sure you opened the latest email or submit a new request.',
            icon: Link2Off,
            iconClassName: 'bg-rose-500/10 text-rose-700',
          }

  const Icon = viewModel.icon
  const caseId = state.kind === 'pending' ? null : state.caseId

  return (
    <div
      className="min-h-screen px-4 py-12 sm:px-6 lg:px-8"
      style={{ backgroundImage: getBrandBackground(brandColor) }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="text-center">
          <div className="flex justify-center">
            {logoUrl && isLogoVisible ? (
              <img
                src={logoUrl}
                alt={`${state.companyName} logo`}
                className="size-14 rounded-3xl border border-white/80 bg-white object-cover shadow-sm"
                onError={() => setIsLogoVisible(false)}
              />
            ) : (
              <div
                className="flex size-14 items-center justify-center rounded-3xl"
                style={getBrandIconStyle(brandColor)}
              >
                <ShieldCheck className="size-7" />
              </div>
            )}
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {state.companyName}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            Email verification
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            This step confirms that the request email belongs to the requester before work begins.
          </p>
        </div>

        <Card className="border-border/70 bg-white/95 shadow-lg shadow-slate-200/40">
          <CardHeader className="items-center text-center">
            <div className={`flex size-14 items-center justify-center rounded-full ${viewModel.iconClassName}`}>
              <Icon className={state.kind === 'pending' ? 'size-7 animate-pulse' : 'size-7'} />
            </div>
            <div className="mt-3 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              {viewModel.badgeLabel}
            </div>
            <CardTitle className="mt-3">{viewModel.title}</CardTitle>
            <CardDescription className="max-w-xl text-balance">
              {viewModel.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {caseId ? (
              <div className="rounded-2xl border border-border/70 bg-muted/40 px-5 py-4 text-center">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Case ID
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-[0.08em] text-foreground">
                  {caseId}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoPanel
                title="Verification"
                description={
                  state.kind === 'verified'
                    ? 'The verification link has been used successfully and cannot be reused.'
                    : 'Verification links are single-use and expire automatically for safety.'
                }
              />
              <InfoPanel
                title="What to do next"
                description={
                  state.kind === 'verified'
                    ? 'You can close this page. The team now has the confirmation needed to continue.'
                    : supportEmail
                      ? `If you still need help, contact ${supportEmail} or submit a new request so a fresh verification link can be issued.`
                      : 'If you still need help, submit a new request from the public intake form so a fresh verification link can be issued.'
                }
              />
            </div>

            {state.workspaceSlug ? (
              <Button
                asChild
                className="w-full sm:w-fit"
                style={getBrandButtonStyle(brandColor)}
              >
                <Link href={`/request/${state.workspaceSlug}`}>
                  Return to request form
                  <RotateCcw data-icon="inline-end" />
                </Link>
              </Button>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 shrink-0" />
                <p>The verification link does not include a valid public request form destination.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}
