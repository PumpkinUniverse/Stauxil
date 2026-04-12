'use client'

import { useState, type FormEvent } from 'react'
import { LockKeyhole, NotebookPen } from 'lucide-react'
import { formatDateTime, formatRelativeDateTime } from '@/components/stauxil/request-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type RequestNote = {
  id: string
  createdAt: number
  body: string
  isInternal: boolean
  authorLabel: string
}

type FeedbackState =
  | {
      kind: 'success' | 'error'
      message: string
    }
  | null

export function RequestNotesPanel({
  notes,
  onCreateNote,
}: {
  notes: RequestNote[]
  onCreateNote: (body: string) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedBody = body.trim()

    if (!trimmedBody) {
      setFeedback({
        kind: 'error',
        message: 'Add a note before saving.',
      })
      return
    }

    setFeedback(null)
    setIsSubmitting(true)

    try {
      await onCreateNote(trimmedBody)
      setBody('')
      setFeedback({
        kind: 'success',
        message: 'Internal note saved.',
      })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Internal notes</CardTitle>
          <Badge variant="secondary">
            <LockKeyhole className="size-3" />
            Internal
          </Badge>
        </div>
        <CardDescription>
          Keep operator-only context on the request. Every saved note also records an activity
          event.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium">
            Add note
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Capture internal context, next steps, or requester follow-up notes"
              className="min-h-28"
              disabled={isSubmitting}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting || body.trim().length === 0}>
              <NotebookPen />
              {isSubmitting ? 'Saving note...' : 'Save note'}
            </Button>
            <FeedbackMessage feedback={feedback} />
          </div>
        </form>

        {notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No internal notes yet. Add context, escalation details, or requester follow-up notes
            here as the case moves forward.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{note.authorLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(note.createdAt)} ({formatRelativeDateTime(note.createdAt)})
                  </p>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{note.body}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'We could not save that note. Try again.'
}
