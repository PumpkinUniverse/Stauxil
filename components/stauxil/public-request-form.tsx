'use client'
/* eslint-disable @next/next/no-img-element */

import { type FormEvent, type ReactNode, startTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from 'convex/react'
import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  getBrandBackground,
  getBrandButtonStyle,
  getBrandIconStyle,
} from '@/lib/stauxil/branding'
import { REQUEST_TYPE_LABELS, type RequestType } from '@/lib/stauxil/constants'
import { cn } from '@/lib/utils'

type PublicWorkspace = {
  workspaceSlug: string
  companyName: string
  introCopy: string
  successMessage: string
  allowedRequestTypes: RequestType[]
  supportEmail: string | null
  timezone: string
  defaultSlaDays: number
  brandColor: string
  logoUrl: string | null
  planLabel: string
  requestIntakeOpen: boolean
  requestIntakeMessage: string | null
  requestsThisMonth: number
  requestLimit: number | null
}

type FormValues = {
  fullName: string
  email: string
  requestType: RequestType
  jurisdiction: string
  accountReference: string
  details: string
}

type FormErrors = Partial<Record<keyof FormValues | 'form', string>>

export function PublicRequestForm({ workspace }: { workspace: PublicWorkspace }) {
  const router = useRouter()
  const createPublicRequest = useMutation(api.requests.createPublicRequest)
  const [isLogoVisible, setIsLogoVisible] = useState(Boolean(workspace.logoUrl))
  const [values, setValues] = useState<FormValues>({
    fullName: '',
    email: '',
    requestType: workspace.allowedRequestTypes[0],
    jurisdiction: '',
    accountReference: '',
    details: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateValue<Key extends keyof FormValues>(key: Key, value: FormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!workspace.requestIntakeOpen) {
      setErrors({
        form:
          workspace.requestIntakeMessage ??
          'This workspace cannot accept more requests right now.',
      })
      return
    }

    const nextErrors = validateForm(values, workspace.allowedRequestTypes)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const result = await createPublicRequest({
        workspaceSlug: workspace.workspaceSlug,
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        requestType: values.requestType,
        jurisdiction: values.jurisdiction.trim(),
        details: values.details.trim(),
        ...(values.accountReference.trim()
          ? { accountReference: values.accountReference.trim() }
          : {}),
      })

      const searchParams = new URLSearchParams({
        workspace: result.workspaceSlug,
        caseId: result.caseId,
      })

      startTransition(() => {
        router.push(`/request/success?${searchParams.toString()}`)
      })
    } catch (error) {
      setErrors({
        form: getUserFacingErrorMessage(error),
      })
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundImage: getBrandBackground(workspace.brandColor) }}
    >
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
        <section className="flex flex-col justify-between gap-8 rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-sm backdrop-blur sm:p-10">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              {workspace.logoUrl && isLogoVisible ? (
                <img
                  src={workspace.logoUrl}
                  alt={`${workspace.companyName} logo`}
                  className="size-11 rounded-2xl border border-white/80 bg-white object-cover"
                  onError={() => setIsLogoVisible(false)}
                />
              ) : (
                <div
                  className="flex size-11 items-center justify-center rounded-2xl"
                  style={getBrandIconStyle(workspace.brandColor)}
                >
                  <ShieldCheck />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {workspace.companyName}
                </span>
                <span className="text-sm text-muted-foreground">Privacy request form</span>
              </div>
            </div>

            <div className="flex max-w-2xl flex-col gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                Submit a privacy request
              </h1>
              <p className="text-base leading-7 text-muted-foreground">{workspace.introCopy}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FeatureCard
                title="Clear intake"
                description="Share the request type, region, and any account reference in one place."
              />
              <FeatureCard
                title="Case tracking"
                description="You will receive a case reference after submission for future follow-up."
              />
              <FeatureCard
                title="Deadline tracking"
                description={`This workspace tracks intake against a default ${workspace.defaultSlaDays}-day SLA in ${workspace.timezone}.`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 p-5">
            <p className="text-sm font-medium text-foreground">Before you submit</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Include enough detail for the team to locate the account or records involved. Avoid
              sending passwords, payment card numbers, or other secrets through this form.
            </p>
            {workspace.supportEmail ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Need help with this intake? Contact{' '}
                <a
                  href={`mailto:${workspace.supportEmail}`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {workspace.supportEmail}
                </a>
                .
              </p>
            ) : null}
          </div>
        </section>

        <Card className="border-border/70 bg-white/95 shadow-lg shadow-slate-200/50">
          <CardHeader className="gap-3 border-b border-border/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Request details</CardTitle>
                <CardDescription>
                  Required fields are marked clearly so the team can review the case without
                  back-and-forth.
                </CardDescription>
              </div>
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                Public intake
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
              {!workspace.requestIntakeOpen ? (
                <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">New request intake is paused</p>
                    <p>
                      {workspace.requestIntakeMessage ??
                        'This workspace cannot accept more requests right now.'}
                    </p>
                  </div>
                </div>
              ) : null}

              <Field
                label="Full name"
                fieldId="fullName"
                error={errors.fullName}
                required
              >
                <Input
                  id="fullName"
                  value={values.fullName}
                  onChange={(event) => updateValue('fullName', event.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.fullName)}
                />
              </Field>

              <Field label="Email" fieldId="email" error={errors.email} required>
                <Input
                  id="email"
                  type="email"
                  value={values.email}
                  onChange={(event) => updateValue('email', event.target.value)}
                  placeholder="jane@example.com"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Request type"
                  fieldId="requestType"
                  error={errors.requestType}
                  required
                >
                  <select
                    id="requestType"
                    value={values.requestType}
                    onChange={(event) =>
                      updateValue('requestType', event.target.value as RequestType)
                    }
                    className={cn(
                      'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                      errors.requestType && 'border-destructive focus-visible:ring-destructive/20'
                    )}
                    aria-invalid={Boolean(errors.requestType)}
                  >
                    {workspace.allowedRequestTypes.map((requestType) => (
                      <option key={requestType} value={requestType}>
                        {REQUEST_TYPE_LABELS[requestType]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Jurisdiction or region"
                  fieldId="jurisdiction"
                  error={errors.jurisdiction}
                  required
                >
                  <Input
                    id="jurisdiction"
                    value={values.jurisdiction}
                    onChange={(event) => updateValue('jurisdiction', event.target.value)}
                    placeholder="California, EEA, United Kingdom"
                    aria-invalid={Boolean(errors.jurisdiction)}
                  />
                </Field>
              </div>

              <Field
                label="Customer or account reference"
                fieldId="accountReference"
                error={errors.accountReference}
                optionalLabel="Optional"
              >
                <Input
                  id="accountReference"
                  value={values.accountReference}
                  onChange={(event) => updateValue('accountReference', event.target.value)}
                  placeholder="Account number, order ID, or customer reference"
                  aria-invalid={Boolean(errors.accountReference)}
                />
              </Field>

              <Field label="Details" fieldId="details" error={errors.details} required>
                <Textarea
                  id="details"
                  value={values.details}
                  onChange={(event) => updateValue('details', event.target.value)}
                  placeholder="Describe the request and any context that will help the team locate the right records."
                  aria-invalid={Boolean(errors.details)}
                />
              </Field>

              {errors.form ? (
                <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 shrink-0" />
                  <p>{errors.form}</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 pt-2">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting || !workspace.requestIntakeOpen}
                  style={getBrandButtonStyle(workspace.brandColor)}
                >
                  {!workspace.requestIntakeOpen
                    ? 'Request intake unavailable'
                    : isSubmitting
                      ? 'Submitting request...'
                      : 'Submit request'}
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  This form helps the team manage privacy requests, track deadlines, and keep an
                  audit trail for each case.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/75 p-5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function Field({
  label,
  fieldId,
  error,
  required = false,
  optionalLabel,
  children,
}: {
  label: string
  fieldId: string
  error?: string
  required?: boolean
  optionalLabel?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor={fieldId}>
          {label}
        </label>
        {required ? (
          <span className="text-xs font-medium text-muted-foreground">Required</span>
        ) : optionalLabel ? (
          <span className="text-xs font-medium text-muted-foreground">{optionalLabel}</span>
        ) : null}
      </div>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function validateForm(values: FormValues, allowedRequestTypes: RequestType[]) {
  const errors: FormErrors = {}
  const allowedTypes = new Set<RequestType>(allowedRequestTypes)

  if (!values.fullName.trim()) {
    errors.fullName = 'Enter your full name.'
  }

  if (!values.email.trim()) {
    errors.email = 'Enter your email address.'
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!allowedTypes.has(values.requestType)) {
    errors.requestType = 'Select a valid request type.'
  }

  if (!values.jurisdiction.trim()) {
    errors.jurisdiction = 'Enter your jurisdiction or region.'
  }

  if (values.accountReference.trim().length > 120) {
    errors.accountReference = 'Keep the reference under 120 characters.'
  }

  if (!values.details.trim()) {
    errors.details = 'Describe the request so the team can review it.'
  } else if (values.details.trim().length < 20) {
    errors.details = 'Add a bit more detail so the request can be routed correctly.'
  }

  return errors
}

function getUserFacingErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'We could not submit your request. Review the form and try again.'
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
