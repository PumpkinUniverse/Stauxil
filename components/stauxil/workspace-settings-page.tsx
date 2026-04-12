'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { useActiveWorkspace } from '@/components/stauxil/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_STAUXIL_BRAND_COLOR } from '@/lib/stauxil/billing'
import { REQUEST_TYPE_LABELS, REQUEST_TYPE_VALUES, type RequestType } from '@/lib/stauxil/constants'
import {
  COMMON_TIMEZONE_OPTIONS,
  getBrandBackground,
  getBrandIconStyle,
  isValidEmailAddress,
  isValidHexColor,
  isValidLogoUrl,
  isValidTimeZone,
  normalizeBrandColor,
} from '@/lib/stauxil/branding'
import { cn } from '@/lib/utils'

type SettingsFormValues = {
  name: string
  supportEmail: string
  timezone: string
  defaultSlaDays: string
  brandColor: string
  logoUrl: string
  allowedRequestTypes: RequestType[]
  publicIntakeIntro: string
  publicIntakeSuccessMessage: string
}

type SettingsFormErrors = Partial<Record<keyof SettingsFormValues | 'form', string>>

export function WorkspaceSettingsPage() {
  const { workspaceId } = useActiveWorkspace()
  const settings = useQuery(api.workspaces.getSettings, { workspaceId })
  const billing = useQuery(api.workspaces.getBillingSnapshot, { workspaceId })
  const updateSettings = useMutation(api.workspaces.updateSettings)
  const [values, setValues] = useState<SettingsFormValues | null>(null)
  const [errors, setErrors] = useState<SettingsFormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const canUseCustomBranding = billing?.features.customBrandingEnabled ?? true

  useEffect(() => {
    if (!settings) {
      return
    }

    setValues({
      name: settings.name,
      supportEmail: settings.supportEmail,
      timezone: settings.timezone,
      defaultSlaDays: String(settings.defaultSlaDays),
      brandColor: settings.brandColor,
      logoUrl: settings.logoUrl,
      allowedRequestTypes: settings.allowedRequestTypes,
      publicIntakeIntro: settings.publicIntakeIntro,
      publicIntakeSuccessMessage: settings.publicIntakeSuccessMessage,
    })
  }, [settings])

  const preview = useMemo(() => {
    if (!values) {
      return null
    }

    return {
      companyName: values.name.trim() || 'Stauxil',
      supportEmail: values.supportEmail.trim(),
      timezone: values.timezone.trim(),
      defaultSlaDays: values.defaultSlaDays.trim(),
      brandColor: canUseCustomBranding
        ? normalizeBrandColor(values.brandColor)
        : DEFAULT_STAUXIL_BRAND_COLOR,
      logoUrl: canUseCustomBranding ? values.logoUrl.trim() : '',
      allowedRequestTypes: values.allowedRequestTypes,
      publicIntakeIntro: values.publicIntakeIntro.trim(),
      publicIntakeSuccessMessage: values.publicIntakeSuccessMessage.trim(),
    }
  }, [canUseCustomBranding, values])

  if (settings === undefined || values === null || preview === null) {
    return <WorkspaceSettingsSkeleton />
  }

  const formValues = values

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateSettings(formValues)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setSaveMessage(null)
      return
    }

    setIsSaving(true)
    setErrors({})
    setSaveMessage(null)

    try {
      const result = await updateSettings({
        workspaceId,
        name: formValues.name.trim(),
        supportEmail: formValues.supportEmail.trim(),
        timezone: formValues.timezone.trim(),
        defaultSlaDays: Number.parseInt(formValues.defaultSlaDays, 10),
        brandColor: normalizeBrandColor(formValues.brandColor),
        logoUrl: formValues.logoUrl.trim() || null,
        allowedRequestTypes: formValues.allowedRequestTypes,
        publicIntakeIntro: formValues.publicIntakeIntro,
        publicIntakeSuccessMessage: formValues.publicIntakeSuccessMessage,
      })

      setValues({
        name: result.settings.name,
        supportEmail: result.settings.supportEmail,
        timezone: result.settings.timezone,
        defaultSlaDays: String(result.settings.defaultSlaDays),
        brandColor: result.settings.brandColor,
        logoUrl: result.settings.logoUrl,
        allowedRequestTypes: result.settings.allowedRequestTypes,
        publicIntakeIntro: result.settings.publicIntakeIntro,
        publicIntakeSuccessMessage: result.settings.publicIntakeSuccessMessage,
      })
      setSaveMessage('Workspace settings saved.')
    } catch (error) {
      setErrors({
        form: getUserFacingErrorMessage(error),
      })
    } finally {
      setIsSaving(false)
    }
  }

  function updateField<Key extends keyof SettingsFormValues>(
    key: Key,
    value: SettingsFormValues[Key]
  ) {
    setValues((current) => {
      if (current === null) {
        return current
      }

      return {
        ...current,
        [key]: value,
      }
    })
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
    setSaveMessage(null)
  }

  function toggleRequestType(requestType: RequestType) {
    const currentRequestTypes = new Set(formValues.allowedRequestTypes)

    if (currentRequestTypes.has(requestType)) {
      currentRequestTypes.delete(requestType)
    } else {
      currentRequestTypes.add(requestType)
    }

    const nextRequestTypes = REQUEST_TYPE_VALUES.filter((value) =>
      currentRequestTypes.has(value)
    )

    updateField('allowedRequestTypes', nextRequestTypes)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Workspace settings</Badge>
            <Badge variant="outline">Workspace scoped</Badge>
          </div>
          <CardTitle>Branding and intake defaults</CardTitle>
          <CardDescription>
            Update public request form branding, intake defaults, and support contact details for
            the active workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
            {billing?.features.customBrandingEnabled === false ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-900">
                <p className="font-medium">Custom branding is locked on {billing.planLabel}</p>
                <p className="mt-2">{billing.messages.customBranding}</p>
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Company or workspace name" fieldId="workspaceName" error={errors.name} required>
                <Input
                  id="workspaceName"
                  value={formValues.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Stauxil"
                  aria-invalid={Boolean(errors.name)}
                />
              </Field>

              <Field label="Support email" fieldId="supportEmail" error={errors.supportEmail} required>
                <Input
                  id="supportEmail"
                  type="email"
                  value={formValues.supportEmail}
                  onChange={(event) => updateField('supportEmail', event.target.value)}
                  placeholder="privacy@stauxil.com"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.supportEmail)}
                />
              </Field>

              <Field label="Timezone" fieldId="timezone" error={errors.timezone} required>
                <>
                  <Input
                    id="timezone"
                    value={formValues.timezone}
                    onChange={(event) => updateField('timezone', event.target.value)}
                    placeholder="America/New_York"
                    list="workspace-timezones"
                    aria-invalid={Boolean(errors.timezone)}
                  />
                  <datalist id="workspace-timezones">
                    {COMMON_TIMEZONE_OPTIONS.map((timezone) => (
                      <option key={timezone} value={timezone} />
                    ))}
                  </datalist>
                </>
              </Field>

              <Field
                label="Default SLA days"
                fieldId="defaultSlaDays"
                error={errors.defaultSlaDays}
                required
              >
                <Input
                  id="defaultSlaDays"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={formValues.defaultSlaDays}
                  onChange={(event) => updateField('defaultSlaDays', event.target.value)}
                  aria-invalid={Boolean(errors.defaultSlaDays)}
                />
              </Field>

              <Field label="Brand color" fieldId="brandColor" error={errors.brandColor} required>
                <div className="flex gap-3">
                  <Input
                    id="brandColor"
                    type="color"
                    value={normalizeBrandColor(formValues.brandColor)}
                    onChange={(event) => updateField('brandColor', event.target.value)}
                    className="h-11 w-16 cursor-pointer p-1"
                    aria-invalid={Boolean(errors.brandColor)}
                    disabled={!canUseCustomBranding}
                  />
                  <Input
                    value={formValues.brandColor}
                    onChange={(event) => updateField('brandColor', event.target.value)}
                    placeholder="#537dc4"
                    aria-invalid={Boolean(errors.brandColor)}
                    disabled={!canUseCustomBranding}
                  />
                </div>
              </Field>

              <Field
                label="Logo URL"
                fieldId="logoUrl"
                error={errors.logoUrl}
                optionalLabel="Optional"
              >
                <Input
                  id="logoUrl"
                  type="url"
                  value={formValues.logoUrl}
                  onChange={(event) => updateField('logoUrl', event.target.value)}
                  placeholder="https://example.com/logo.png"
                  aria-invalid={Boolean(errors.logoUrl)}
                  disabled={!canUseCustomBranding}
                />
              </Field>
            </div>

            <Field
              label="Allowed request types"
              fieldId="allowedRequestTypes"
              error={errors.allowedRequestTypes}
              required
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {REQUEST_TYPE_VALUES.map((requestType) => {
                  const checked = formValues.allowedRequestTypes.includes(requestType)

                  return (
                    <label
                      key={requestType}
                      htmlFor={`request-type-${requestType}`}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors',
                        checked
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <input
                        id={`request-type-${requestType}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRequestType(requestType)}
                        className="size-4 rounded border-border"
                      />
                      <span>{REQUEST_TYPE_LABELS[requestType]}</span>
                    </label>
                  )
                })}
              </div>
            </Field>

            <div className="grid gap-5 lg:grid-cols-2">
              <Field
                label="Public form intro copy"
                fieldId="publicIntakeIntro"
                error={errors.publicIntakeIntro}
                required
              >
                <Textarea
                  id="publicIntakeIntro"
                  value={formValues.publicIntakeIntro}
                  onChange={(event) => updateField('publicIntakeIntro', event.target.value)}
                  placeholder="Explain what the public form is for and how the team will use the request details."
                  className="min-h-28"
                  aria-invalid={Boolean(errors.publicIntakeIntro)}
                />
              </Field>

              <Field
                label="Submission success message"
                fieldId="publicIntakeSuccessMessage"
                error={errors.publicIntakeSuccessMessage}
                required
              >
                <Textarea
                  id="publicIntakeSuccessMessage"
                  value={formValues.publicIntakeSuccessMessage}
                  onChange={(event) =>
                    updateField('publicIntakeSuccessMessage', event.target.value)
                  }
                  placeholder="Tell the requester what happens next after the form is submitted."
                  className="min-h-28"
                  aria-invalid={Boolean(errors.publicIntakeSuccessMessage)}
                />
              </Field>
            </div>

            {errors.form ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {errors.form}
              </div>
            ) : null}

            {saveMessage ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
                {saveMessage}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Settings save to current workspace only. Public request links stay on the current
                slug.
              </p>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving settings...' : 'Save settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Outbound email</Badge>
              <Badge variant="outline">Platform sender</Badge>
            </div>
            <CardTitle>Resend delivery path</CardTitle>
            <CardDescription>
              Stauxil sends request emails from the shared platform mailbox configured in Vercel.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              Verification emails and request updates use the same Resend delivery path so request
              history stays consistent across the workspace.
            </p>
            <p>
              Replies go to this workspace&apos;s support email when it is set. If support email is
              unavailable, Stauxil falls back to the deployment-level reply-to setting.
            </p>
            <p>
              Per-workspace sender-domain verification is not part of this MVP. Keep the support
              email current so requesters always reply to the right team inbox.
            </p>
          </CardContent>
        </Card>

        {billing ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Plan and limits</Badge>
                <Badge variant="outline">{billing.planLabel}</Badge>
              </div>
              <CardTitle>Workspace capacity</CardTitle>
              <CardDescription>
                Keep request and member capacity visible for the active workspace plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>
                Requests this month: {billing.usage.requestsThisMonth}
                {billing.usage.requestLimit === null ? '' : ` / ${billing.usage.requestLimit}`}
              </p>
              <p>
                Members: {billing.usage.members}
                {billing.usage.memberLimit === null ? '' : ` / ${billing.usage.memberLimit}`}
              </p>
              <p>
                Exports: {billing.features.exportsEnabled ? 'Available' : 'Locked on current plan'}
              </p>
              <p>
                Custom branding:{' '}
                {billing.features.customBrandingEnabled ? 'Available' : 'Locked on current plan'}
              </p>
              {billing.limits.memberLimitReached ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-900">
                  {billing.messages.memberLimit}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <div className="px-6 pt-6">
            <Badge variant="secondary">Public form preview</Badge>
          </div>
          <div
            className="m-6 rounded-[1.75rem] border border-white/70 p-6 shadow-sm"
            style={{ backgroundImage: getBrandBackground(preview.brandColor) }}
          >
            <div className="flex items-center gap-3">
              {preview.logoUrl ? (
                <img
                  src={preview.logoUrl}
                  alt={`${preview.companyName} logo`}
                  className="size-12 rounded-2xl border border-white/80 bg-white object-cover"
                />
              ) : (
                <div
                  className="flex size-12 items-center justify-center rounded-2xl"
                  style={getBrandIconStyle(preview.brandColor)}
                >
                  <ShieldCheck />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{preview.companyName}</p>
                <p className="text-sm text-muted-foreground">Stauxil public intake form</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                Submit a privacy request
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {preview.publicIntakeIntro ||
                  'Public form shows workspace branding, allowed request types, support email, and intake defaults from these settings.'}
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <PreviewPanel
                label="Support"
                value={preview.supportEmail || 'Add a support email to show it publicly.'}
              />
              <PreviewPanel
                label="Deadline tracking"
                value={`${preview.defaultSlaDays || '30'}-day default SLA in ${preview.timezone || 'UTC'}`}
              />
              <PreviewPanel
                label="Success message"
                value={
                  preview.publicIntakeSuccessMessage ||
                  'Your request has been received. Keep your case ID for reference while the team reviews the case.'
                }
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {preview.allowedRequestTypes.map((requestType) => (
                <span
                  key={requestType}
                  className="rounded-full border border-border/80 bg-white/70 px-3 py-1 text-xs font-medium text-foreground"
                >
                  {REQUEST_TYPE_LABELS[requestType]}
                </span>
              ))}
            </div>
          </div>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Public intake link</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {settings.publicFormPath ??
                  'Public form link unavailable until a support email is saved for this workspace.'}
              </p>
            </div>

            {settings.publicFormPath ? (
              <Button asChild variant="outline" className="w-full sm:w-fit">
                <Link href={settings.publicFormPath} target="_blank" rel="noreferrer">
                  Open public form
                  <ExternalLink data-icon="inline-end" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What updates now</CardTitle>
            <CardDescription>
              These settings keep public intake and workspace operations aligned.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>Workspace name updates the authenticated shell and public intake branding.</p>
            <p>Support email, logo URL, and brand color flow into public request surfaces.</p>
            <p>Support email also becomes the Reply-To destination for outbound request emails.</p>
            <p>Public intake links stay blocked until support email is configured.</p>
            <p>Timezone, SLA days, and allowed request types update intake defaults safely.</p>
            <p>Intro and success copy shape the public submission experience for this workspace.</p>
          </CardContent>
        </Card>
      </div>
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
        <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
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

function PreviewPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  )
}

function WorkspaceSettingsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

function validateSettings(values: SettingsFormValues) {
  const errors: SettingsFormErrors = {}
  const name = values.name.trim()
  const supportEmail = values.supportEmail.trim()
  const timezone = values.timezone.trim()
  const defaultSlaDays = values.defaultSlaDays.trim()
  const brandColor = values.brandColor.trim()
  const logoUrl = values.logoUrl.trim()
  const publicIntakeIntro = values.publicIntakeIntro.trim()
  const publicIntakeSuccessMessage = values.publicIntakeSuccessMessage.trim()

  if (!name) {
    errors.name = 'Enter a workspace name.'
  } else if (name.length > 80) {
    errors.name = 'Keep the workspace name under 80 characters.'
  }

  if (!supportEmail) {
    errors.supportEmail = 'Enter a support email.'
  } else if (!isValidEmailAddress(supportEmail)) {
    errors.supportEmail = 'Enter a valid support email address.'
  }

  if (!timezone) {
    errors.timezone = 'Enter a timezone.'
  } else if (!isValidTimeZone(timezone)) {
    errors.timezone = 'Use a valid IANA timezone like America/New_York.'
  }

  if (!defaultSlaDays) {
    errors.defaultSlaDays = 'Enter default SLA days.'
  } else {
    const parsedValue = Number.parseInt(defaultSlaDays, 10)
    if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 365) {
      errors.defaultSlaDays = 'Use a whole number between 1 and 365.'
    }
  }

  if (!brandColor) {
    errors.brandColor = 'Enter a brand color.'
  } else if (!isValidHexColor(brandColor)) {
    errors.brandColor = 'Use a 6-digit hex color like #537dc4.'
  }

  if (logoUrl.length > 500) {
    errors.logoUrl = 'Keep the logo URL under 500 characters.'
  } else if (!isValidLogoUrl(logoUrl)) {
    errors.logoUrl = 'Logo URL must start with http:// or https://.'
  }

  if (publicIntakeIntro.length > 600) {
    errors.publicIntakeIntro = 'Keep the public form intro copy under 600 characters.'
  }

  if (publicIntakeSuccessMessage.length > 240) {
    errors.publicIntakeSuccessMessage = 'Keep the success message under 240 characters.'
  }

  if (values.allowedRequestTypes.length === 0) {
    errors.allowedRequestTypes = 'Select at least one request type.'
  }

  return errors
}

function getUserFacingErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Unable to save workspace settings right now.'
}
