'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useAction, useMutation } from 'convex/react'
import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import {
  formatDateTime,
  formatRelativeDateTime,
} from '@/components/stauxil/request-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  EMAIL_PROVIDER_LABELS,
  WORKSPACE_SENDER_FALLBACK_MODE_LABELS,
  WORKSPACE_SENDER_STATUS_LABELS,
  type MemberRole,
  type WorkspaceSenderFallbackMode,
  type WorkspaceSenderStatus,
} from '@/lib/stauxil/constants'
import { cn } from '@/lib/utils'

const MAX_SENDER_DISPLAY_NAME_LENGTH = 80
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type SenderDnsRecord = {
  record: string
  name: string
  type: string
  ttl: string
  status: string
  value: string
  priority?: number | null
}

type WorkspaceSenderSetup = {
  provider: 'resend'
  isPersisted: boolean
  fromEmail: string
  displayName: string
  derivedDomain: string | null
  status: WorkspaceSenderStatus
  providerDomainId: string | null
  verifiedDomain: string | null
  dnsRecords: SenderDnsRecord[]
  fallbackMode: WorkspaceSenderFallbackMode
  lastCheckedAt: number | null
  verifiedAt: number | null
  failureReason: string | null
}

type SenderFormValues = {
  fromEmail: string
  displayName: string
}

type SenderFormErrors = Partial<Record<keyof SenderFormValues | 'form', string>>

type FeedbackState =
  | {
      kind: 'success' | 'error'
      message: string
    }
  | null

export function WorkspaceSenderSettingsCard({
  workspaceId,
  membershipRole,
  supportEmail,
  senderSetup,
}: {
  workspaceId: Id<'workspaces'>
  membershipRole: MemberRole
  supportEmail: string
  senderSetup: WorkspaceSenderSetup
}) {
  const saveWorkspaceSenderSetup = useMutation(api.workspaceSenders.saveWorkspaceSenderSetup)
  const startWorkspaceSenderVerification = useAction(
    api.workspaceSenders.startWorkspaceSenderVerification
  )
  const refreshWorkspaceSenderStatus = useAction(api.workspaceSenders.refreshWorkspaceSenderStatus)
  const disableWorkspaceSender = useMutation(api.workspaceSenders.disableWorkspaceSender)

  const [setupSnapshot, setSetupSnapshot] = useState(senderSetup)
  const [formValues, setFormValues] = useState<SenderFormValues>({
    fromEmail: senderSetup.fromEmail,
    displayName: senderSetup.displayName,
  })
  const [errors, setErrors] = useState<SenderFormErrors>({})
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isStartingSetup, setIsStartingSetup] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)

  useEffect(() => {
    setSetupSnapshot(senderSetup)
    setFormValues({
      fromEmail: senderSetup.fromEmail,
      displayName: senderSetup.displayName,
    })
  }, [senderSetup])

  const canManage = membershipRole === 'owner'
  const trimmedSupportEmail = supportEmail.trim()
  const trimmedFromEmail = formValues.fromEmail.trim().toLowerCase()
  const trimmedDisplayName = formValues.displayName.trim()
  const isDirty =
    trimmedFromEmail !== setupSnapshot.fromEmail ||
    trimmedDisplayName !== setupSnapshot.displayName

  async function saveCurrentValues() {
    const nextErrors = validateSenderForm(formValues)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setFeedback(null)
      return null
    }

    const nextSetup = await saveWorkspaceSenderSetup({
      workspaceId,
      fromEmail: trimmedFromEmail,
      displayName: trimmedDisplayName,
    })

    setSetupSnapshot(nextSetup)
    setFormValues({
      fromEmail: nextSetup.fromEmail,
      displayName: nextSetup.displayName,
    })
    setErrors({})
    return nextSetup
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canManage) {
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const nextSetup = await saveCurrentValues()
      if (nextSetup === null) {
        return
      }

      setFeedback({
        kind: 'success',
        message: 'Outbound sender settings saved. Start setup when you are ready to pull DNS records.',
      })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: getUserFacingErrorMessage(error),
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStartSetup() {
    if (!canManage) {
      return
    }

    setIsStartingSetup(true)
    setFeedback(null)

    try {
      let nextSetup = setupSnapshot

      if (!nextSetup.isPersisted || isDirty) {
        const savedSetup = await saveCurrentValues()
        if (savedSetup === null) {
          return
        }

        nextSetup = savedSetup
      }

      const verifiedSetup = await startWorkspaceSenderVerification({
        workspaceId,
      })

      setSetupSnapshot(verifiedSetup)
      setFormValues({
        fromEmail: verifiedSetup.fromEmail,
        displayName: verifiedSetup.displayName,
      })
      setFeedback({
        kind: 'success',
        message:
          verifiedSetup.status === 'verified'
            ? 'Workspace sender verified and ready to use.'
            : 'Sender setup started. Add the DNS records below, then refresh status after DNS propagates.',
      })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: getUserFacingErrorMessage(error),
      })
    } finally {
      setIsStartingSetup(false)
    }
  }

  async function handleRefreshStatus() {
    if (!canManage) {
      return
    }

    setIsRefreshing(true)
    setFeedback(null)

    try {
      const nextSetup = await refreshWorkspaceSenderStatus({
        workspaceId,
      })

      setSetupSnapshot(nextSetup)
      setFormValues({
        fromEmail: nextSetup.fromEmail,
        displayName: nextSetup.displayName,
      })
      setFeedback({
        kind: 'success',
        message:
          nextSetup.status === 'verified'
            ? 'Workspace sender is verified and active.'
            : 'Sender status refreshed from Resend.',
      })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: getUserFacingErrorMessage(error),
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleDisableSender() {
    if (!canManage) {
      return
    }

    setIsDisabling(true)
    setFeedback(null)

    try {
      const nextSetup = await disableWorkspaceSender({
        workspaceId,
      })

      setSetupSnapshot(nextSetup)
      setFormValues({
        fromEmail: nextSetup.fromEmail,
        displayName: nextSetup.displayName,
      })
      setFeedback({
        kind: 'success',
        message: 'Workspace sender disabled. Verification emails will use the platform sender.',
      })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: getUserFacingErrorMessage(error),
      })
    } finally {
      setIsDisabling(false)
    }
  }

  function updateField(key: keyof SenderFormValues, value: string) {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }))
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      form: undefined,
    }))
    setFeedback(null)
  }

  const providerLabel = EMAIL_PROVIDER_LABELS[setupSnapshot.provider] ?? setupSnapshot.provider
  const statusLabel =
    WORKSPACE_SENDER_STATUS_LABELS[setupSnapshot.status] ?? setupSnapshot.status
  const fallbackLabel =
    WORKSPACE_SENDER_FALLBACK_MODE_LABELS[setupSnapshot.fallbackMode] ??
    setupSnapshot.fallbackMode
  const domainMismatch =
    setupSnapshot.verifiedDomain !== null &&
    setupSnapshot.derivedDomain !== null &&
    setupSnapshot.verifiedDomain !== setupSnapshot.derivedDomain

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Outbound sender</Badge>
          <Badge variant="outline">{providerLabel}</Badge>
          <Badge variant="outline" className={getSenderStatusClassName(setupSnapshot.status)}>
            {statusLabel}
          </Badge>
        </div>
        <CardTitle>Per-workspace sender domain</CardTitle>
        <CardDescription>
          Verify a workspace-specific sender inside the shared Resend account. Until this sender is
          verified, Stauxil keeps sending with the platform sender so requesters are not blocked.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!canManage ? (
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Only workspace owners can change outbound sender settings. Members can still review the
            current sender state and DNS records here.
          </div>
        ) : null}

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSave} noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="workspaceSenderEmail" className="text-sm font-medium text-foreground">
              Sender email
            </label>
            <Input
              id="workspaceSenderEmail"
              type="email"
              value={formValues.fromEmail}
              onChange={(event) => updateField('fromEmail', event.target.value)}
              placeholder="support@bodyshop.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.fromEmail)}
              disabled={!canManage || isSaving || isStartingSetup || isRefreshing || isDisabling}
            />
            {errors.fromEmail ? <p className="text-sm text-destructive">{errors.fromEmail}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="workspaceSenderDisplayName"
              className="text-sm font-medium text-foreground"
            >
              Display name
            </label>
            <Input
              id="workspaceSenderDisplayName"
              value={formValues.displayName}
              onChange={(event) => updateField('displayName', event.target.value)}
              placeholder="Body Shop Support"
              aria-invalid={Boolean(errors.displayName)}
              disabled={!canManage || isSaving || isStartingSetup || isRefreshing || isDisabling}
            />
            {errors.displayName ? (
              <p className="text-sm text-destructive">{errors.displayName}</p>
            ) : null}
          </div>

          {errors.form ? (
            <div className="md:col-span-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errors.form}
            </div>
          ) : null}

          {feedback ? (
            <div
              className={cn(
                'md:col-span-2 rounded-2xl border px-4 py-3 text-sm',
                feedback.kind === 'success'
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700'
                  : 'border-destructive/20 bg-destructive/5 text-destructive'
              )}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" variant="outline" disabled={!canManage || isSaving}>
              {isSaving ? 'Saving sender...' : 'Save sender'}
            </Button>
            <Button
              type="button"
              disabled={!canManage || isStartingSetup}
              onClick={handleStartSetup}
            >
              {isStartingSetup ? 'Starting setup...' : 'Start setup'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canManage || !setupSnapshot.providerDomainId || isRefreshing}
              onClick={handleRefreshStatus}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh status'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !canManage || !setupSnapshot.isPersisted || setupSnapshot.status === 'disabled' || isDisabling
              }
              onClick={handleDisableSender}
            >
              {isDisabling ? 'Disabling...' : 'Disable sender'}
            </Button>
          </div>
        </form>

        <div className="grid gap-3 lg:grid-cols-2">
          <SummaryPanel
            label="Derived domain"
            value={setupSnapshot.derivedDomain ?? 'Enter a valid sender email to derive a domain.'}
          />
          <SummaryPanel
            label="Verified domain"
            value={setupSnapshot.verifiedDomain ?? 'Platform sender remains active until verification completes.'}
          />
          <SummaryPanel label="Fallback mode" value={fallbackLabel} />
          <SummaryPanel
            label="Reply-To"
            value={
              trimmedSupportEmail ||
              'No workspace support email is set, so the platform reply-to setting stays in effect.'
            }
          />
          <SummaryPanel
            label="Last checked"
            value={formatTimestamp(setupSnapshot.lastCheckedAt)}
          />
          <SummaryPanel
            label="Verified at"
            value={formatTimestamp(setupSnapshot.verifiedAt)}
          />
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Exact domain matching matters</p>
          <p className="mt-2">
            If you want to send from <code className="rounded bg-background px-1 py-0.5">support@bodyshop.com</code>,
            verify <code className="rounded bg-background px-1 py-0.5">bodyshop.com</code>. If you
            verify <code className="rounded bg-background px-1 py-0.5">mail.bodyshop.com</code>,
            then the sender must also use that subdomain, like{' '}
            <code className="rounded bg-background px-1 py-0.5">support@mail.bodyshop.com</code>.
          </p>
          <p className="mt-2">
            Workspace support email still acts as the public contact address and is used as the
            reply-to when it is available.
          </p>
        </div>

        <div
          className={cn(
            'rounded-2xl border px-4 py-4 text-sm',
            getSenderStatusPanelClassName(setupSnapshot.status)
          )}
        >
          <p className="font-medium">{statusLabel}</p>
          <p className="mt-2">{getSenderStatusDescription(setupSnapshot.status)}</p>
          {setupSnapshot.failureReason ? <p className="mt-2">{setupSnapshot.failureReason}</p> : null}
        </div>

        {domainMismatch ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-900">
            The saved sender email uses <span className="font-medium">{setupSnapshot.derivedDomain}</span>,
            but Resend last verified <span className="font-medium">{setupSnapshot.verifiedDomain}</span>.
            Update the sender email or restart setup so the verified domain and sender domain match
            exactly.
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">DNS records</p>
              <p className="text-sm text-muted-foreground">
                Add these records at your DNS provider after setup starts, then refresh status once
                the records propagate.
              </p>
            </div>
            {setupSnapshot.providerDomainId ? (
              <Badge variant="outline">Domain ID: {setupSnapshot.providerDomainId}</Badge>
            ) : null}
          </div>

          {setupSnapshot.dnsRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              DNS records will appear here after you start setup.
            </div>
          ) : (
            <div className="grid gap-3">
              {setupSnapshot.dnsRecords.map((record) => (
                <div
                  key={`${record.type}:${record.name}:${record.value}`}
                  className="rounded-2xl border border-border/70 bg-background px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{record.record}</Badge>
                    <Badge variant="outline">{record.type}</Badge>
                    <Badge variant="outline" className={getDnsStatusClassName(record.status)}>
                      {titleize(record.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <DnsDetail label="Host" value={record.name} />
                    <DnsDetail label="Value" value={record.value} mono />
                    <DnsDetail label="TTL" value={record.ttl} />
                    <DnsDetail
                      label="Priority"
                      value={
                        record.priority === null || record.priority === undefined
                          ? 'Not required'
                          : String(record.priority)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  )
}

function DnsDetail({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-sm text-foreground', mono ? 'break-all font-mono' : '')}>
        {value}
      </span>
    </div>
  )
}

function validateSenderForm(values: SenderFormValues) {
  const errors: SenderFormErrors = {}
  const fromEmail = values.fromEmail.trim().toLowerCase()
  const displayName = values.displayName.trim()

  if (!fromEmail) {
    errors.fromEmail = 'Enter a sender email.'
  } else if (!EMAIL_ADDRESS_PATTERN.test(fromEmail)) {
    errors.fromEmail = 'Enter a valid sender email address.'
  }

  if (!displayName) {
    errors.displayName = 'Enter a display name.'
  } else if (displayName.length > MAX_SENDER_DISPLAY_NAME_LENGTH) {
    errors.displayName = `Keep the display name under ${MAX_SENDER_DISPLAY_NAME_LENGTH} characters.`
  }

  return errors
}

function getSenderStatusClassName(status: WorkspaceSenderStatus) {
  if (status === 'verified') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
  }

  if (status === 'pending' || status === 'not_started') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700'
  }

  if (status === 'failed' || status === 'temporary_failure' || status === 'disabled') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-700'
  }

  return ''
}

function getSenderStatusPanelClassName(status: WorkspaceSenderStatus) {
  if (status === 'verified') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900'
  }

  if (status === 'pending' || status === 'not_started') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-900'
  }

  if (status === 'failed' || status === 'temporary_failure' || status === 'disabled') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-900'
  }

  return 'border-border/70 bg-muted/20 text-foreground'
}

function getSenderStatusDescription(status: WorkspaceSenderStatus) {
  if (status === 'verified') {
    return 'This workspace sender is active. Verification emails can use the workspace sender address now.'
  }

  if (status === 'pending') {
    return 'Resend is still waiting on DNS verification. Keep the platform sender in place, then refresh once DNS records have propagated.'
  }

  if (status === 'not_started') {
    return 'The sender has been saved, but domain setup has not started yet. Start setup to create or reuse the domain and pull DNS records.'
  }

  if (status === 'failed') {
    return 'Resend reported a permanent failure for this sender domain. Review the DNS records or switch to a different domain.'
  }

  if (status === 'temporary_failure') {
    return 'The workspace sender is degraded right now. Stauxil will keep falling back to the platform sender until you refresh or correct the mismatch.'
  }

  if (status === 'disabled') {
    return 'The workspace sender is disabled. Verification emails are using the platform sender only.'
  }

  return 'Save the sender first, then start setup to fetch DNS records and begin verification.'
}

function getDnsStatusClassName(status: string) {
  const normalizedStatus = status.trim().toLowerCase()

  if (normalizedStatus === 'verified') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
  }

  if (normalizedStatus === 'pending' || normalizedStatus === 'not_started') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700'
  }

  if (normalizedStatus === 'failed' || normalizedStatus === 'temporary_failure') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-700'
  }

  return ''
}

function formatTimestamp(value: number | null) {
  if (value === null) {
    return 'Not checked yet'
  }

  return `${formatDateTime(value)} (${formatRelativeDateTime(value)})`
}

function titleize(value: string) {
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function getUserFacingErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Unable to update outbound sender settings right now.'
}
