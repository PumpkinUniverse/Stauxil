'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { FileText, Sparkles } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { useActiveWorkspace } from '@/components/stauxil/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_LABELS,
  EMAIL_TEMPLATE_VARIABLES,
  type EmailTemplateKey,
} from '@/lib/stauxil/constants'
import { cn } from '@/lib/utils'

type FeedbackState =
  | {
      kind: 'success' | 'error'
      message: string
    }
  | null

export function TemplatesPageClient() {
  const { workspaceId, workspaceName } = useActiveWorkspace()
  const templates = useQuery(api.emailTemplates.listEffectiveByWorkspace, {
    workspaceId,
  })
  const upsertTemplate = useMutation(api.emailTemplates.upsert)

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<EmailTemplateKey>('acknowledgment')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [isSaving, setIsSaving] = useState(false)

  const selectedTemplate = useMemo(
    () => templates?.find((template) => template.key === selectedTemplateKey) ?? null,
    [selectedTemplateKey, templates]
  )

  useEffect(() => {
    if (selectedTemplate === null) {
      return
    }

    setName(selectedTemplate.name)
    setDescription(selectedTemplate.description ?? '')
    setSubject(selectedTemplate.subject)
    setBody(selectedTemplate.body)
    setIsEnabled(selectedTemplate.isEnabled)
    setFeedback(null)
  }, [selectedTemplate])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setIsSaving(true)

    try {
      await upsertTemplate({
        workspaceId,
        key: selectedTemplateKey,
        name,
        description: description.trim() || null,
        subject,
        body,
        isEnabled,
      })

      setFeedback({
        kind: 'success',
        message: `${EMAIL_TEMPLATE_LABELS[selectedTemplateKey]} template saved for ${workspaceName}.`,
      })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (templates === undefined) {
    return <TemplatesPageLoadingState />
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Template library</CardTitle>
          <CardDescription>
            One operational template set per workspace. Save changes here, then preview and send
            from a request record.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {templates.map((template) => {
            const isActive = template.key === selectedTemplateKey

            return (
              <button
                key={template.key}
                type="button"
                onClick={() => setSelectedTemplateKey(template.key)}
                className={cn(
                  'flex flex-col gap-3 rounded-2xl border p-4 text-left transition-colors',
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background hover:border-primary/40'
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{EMAIL_TEMPLATE_LABELS[template.key]}</span>
                  <Badge variant={template.isCustomized ? 'secondary' : 'outline'}>
                    {template.isCustomized ? 'Customized' : 'Default'}
                  </Badge>
                  <Badge variant={template.isEnabled ? 'outline' : 'secondary'}>
                    {template.isEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {template.description ?? 'No description'}
                </p>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{EMAIL_TEMPLATE_LABELS[selectedTemplateKey]}</Badge>
              <Badge variant="outline">{workspaceName}</Badge>
            </div>
            <CardTitle>Edit template</CardTitle>
            <CardDescription>
              Keep subject and body practical. Use placeholders to personalize request updates
              without losing a consistent audit trail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSave}>
              <label className="grid gap-2 text-sm font-medium">
                Template name
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Internal description
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What this template is used for"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Subject
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Body
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="min-h-72 font-mono text-sm"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(event) => setIsEnabled(event.target.checked)}
                  className="size-4 rounded border-border"
                />
                Template enabled for request operations
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isSaving}>
                  <FileText />
                  {isSaving ? 'Saving template...' : 'Save template'}
                </Button>
                <FeedbackMessage feedback={feedback} />
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <Card>
            <CardHeader>
            <CardTitle>Available placeholders</CardTitle>
            <CardDescription>
              Use `{'{{variableName}}'}` syntax in subjects and bodies. Previewing a template from
              a request record resolves these placeholders with live request values.
            </CardDescription>
          </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {EMAIL_TEMPLATE_VARIABLES.map((variable) => (
                <div
                  key={variable.key}
                  className="rounded-2xl border border-border bg-background px-3 py-2"
                >
                  <p className="font-mono text-sm font-medium">{`{{${variable.key}}}`}</p>
                  <p className="text-xs text-muted-foreground">{variable.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <CardTitle>Operational preview flow</CardTitle>
              </div>
              <CardDescription>
                Open a request to render a live preview with requester, company, case, due date,
                and request-type values before logging the email entry.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Templates stay workspace-scoped.</p>
              <p>Preview rendering uses live request data.</p>
              <p>Every logged email creates both a request event and an email log record.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function FeedbackMessage({ feedback }: { feedback: FeedbackState }) {
  if (feedback === null) {
    return null
  }

  return (
    <p
      className={cn(
        'text-sm',
        feedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'
      )}
    >
      {feedback.message}
    </p>
  )
}

function TemplatesPageLoadingState() {
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="grid gap-3">
          {EMAIL_TEMPLATE_KEYS.map((key) => (
            <div key={key} className="rounded-2xl border border-border p-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'We could not save that template. Try again.'
}
