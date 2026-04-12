/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { CheckCircle2, MailCheck, RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getBrandBackground,
  getBrandButtonStyle,
  getBrandIconStyle,
} from '@/lib/stauxil/branding'

export function RequestSuccessCard({
  companyName,
  successMessage,
  caseId,
  workspaceSlug,
  requiresVerification = false,
  supportEmail = null,
  brandColor,
  logoUrl = null,
}: {
  companyName: string
  successMessage: string
  caseId: string | null
  workspaceSlug: string | null
  requiresVerification?: boolean
  supportEmail?: string | null
  brandColor: string
  logoUrl?: string | null
}) {
  return (
    <div
      className="min-h-screen px-4 py-12 sm:px-6 lg:px-8"
      style={{ backgroundImage: getBrandBackground(brandColor) }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="text-center">
          <div className="flex justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${companyName} logo`}
                className="size-14 rounded-3xl border border-white/80 bg-white object-cover shadow-sm"
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
            {companyName}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {requiresVerification ? 'Verification required' : 'Request received'}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            {requiresVerification
              ? 'Your request has been recorded. A verification step is required before the team starts work on the case.'
              : 'The request has been saved successfully. Keep the reference below in case the team needs it later.'}
          </p>
        </div>

        <Card className="border-border/70 bg-white/95 shadow-lg shadow-slate-200/40">
          <CardHeader className="items-center text-center">
            <div
              className={
                requiresVerification
                  ? 'flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-700'
                  : 'flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700'
              }
            >
              {requiresVerification ? <MailCheck className="size-7" /> : <CheckCircle2 className="size-7" />}
            </div>
            <CardTitle className="mt-3">
              {requiresVerification ? 'Verification pending' : 'Submission complete'}
            </CardTitle>
            <CardDescription className="max-w-xl text-balance">{successMessage}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-5 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Case ID
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-[0.08em] text-foreground">
                {caseId ?? 'Pending'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoPanel
                title={requiresVerification ? 'Next step' : 'What happens next'}
                description={
                  requiresVerification
                    ? 'Open the verification link when it arrives to confirm the request. If it does not arrive, use the support contact below.'
                    : 'The team can now review the request, assign ownership, and track deadlines from the private workspace.'
                }
              />
              <InfoPanel
                title={supportEmail ? 'Support' : 'Reference'}
                description={
                  supportEmail
                    ? `Need help with this request? Contact ${supportEmail}.`
                    : 'Save the case ID above if you need to refer back to this request later.'
                }
              />
            </div>

            {workspaceSlug ? (
              <Button
                asChild
                className="w-full sm:w-fit"
                style={getBrandButtonStyle(brandColor)}
              >
                <Link href={`/request/${workspaceSlug}`}>
                  Submit another request
                  <RotateCcw data-icon="inline-end" />
                </Link>
              </Button>
            ) : null}
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
