import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCheck,
  Clock3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type GuideIcon = typeof ShieldCheck

const sectionLinks = [
  { href: '#overview', label: 'Overview' },
  { href: '#features', label: 'Key features' },
  { href: '#getting-started', label: 'Getting started' },
  { href: '#workflow', label: 'Usage flow' },
  { href: '#use-cases', label: 'Use cases' },
  { href: '#tips', label: 'Tips' },
  { href: '#faq', label: 'Troubleshooting / FAQ' },
] as const

const heroHighlights = [
  {
    title: 'Public intake',
    description:
      'Share one workspace-specific form so requesters can submit access, deletion, correction, and related requests without signing in.',
    icon: ShieldCheck,
  },
  {
    title: 'Verification first',
    description:
      'Confirm requester email before work begins, keep verification separate from request status, and record every action in the timeline.',
    icon: CheckCheck,
  },
  {
    title: 'Operational workspace',
    description:
      'Review deadlines, assign owners, add internal notes, and keep request activity in a single private workspace.',
    icon: LayoutDashboard,
  },
  {
    title: 'Audit trail',
    description:
      'Track templates, logged emails, printable summaries, and exports when the current plan includes them.',
    icon: FileText,
  },
] as const

const overviewCards = [
  {
    title: 'What Stauxil helps you do',
    description:
      'Stauxil is a privacy request operations app for small businesses. It keeps intake, verification, follow-up, and recordkeeping in one workflow.',
    items: [
      'Publish a public request form tied to your workspace slug.',
      'Verify requester email before work begins.',
      'Assign owners, track deadlines, and monitor overdue requests.',
      'Standardize replies with reusable templates.',
      'Keep notes, email history, and timeline events together.',
      'Export or print case history when your plan includes exports.',
    ],
  },
  {
    title: 'What it does not do',
    description:
      'The MVP is a workflow and documentation layer. It helps teams operate clearly, but it is not a legal advice engine or a deep automation platform.',
    items: [
      'It does not give legal advice or legal conclusions.',
      'It does not automatically delete data from other systems.',
      'It does not verify identity with government ID or selfies.',
      'It does not reopen closed requests in the current workflow.',
    ],
  },
  {
    title: 'Who this page is for',
    description:
      'The source docs are written for workspace owners and leads who set up and monitor request operations.',
    items: [
      'Business owners and operations leads.',
      'Privacy inbox owners and support managers.',
      'Team leads responsible for intake and follow-up.',
      'Anyone rolling out the Stauxil workflow for the first time.',
    ],
  },
] as const

const featureCards = [
  {
    title: 'Public intake and verification',
    description:
      'Accept requests through a branded public page, require core request details, and queue verification immediately after submission.',
    route: '/settings',
    routeLabel: 'Configured from Settings',
    icon: ShieldCheck,
  },
  {
    title: 'Dashboard visibility',
    description:
      'Use summary cards for open, overdue, due-this-week, and completed-this-month requests, then jump into the recent queue.',
    route: '/',
    routeLabel: 'Open Dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Request queue controls',
    description:
      'Search by case ID or requester email, filter by status, owner, type, and overdue state, and export CSV when exports are enabled.',
    route: '/requests',
    routeLabel: 'Open Requests',
    icon: FileText,
  },
  {
    title: 'Case-level operations',
    description:
      'Each request record brings together requester details, verification state, due date, notes, timeline, email history, owner assignment, and close actions.',
    route: '/requests',
    routeLabel: 'Review request details',
    icon: Clock3,
  },
  {
    title: 'Templates and communication',
    description:
      'Manage verification, acknowledgment, more-information-needed, completion, and denial/update templates. Verification is provider-sent in this MVP, while other template actions are logged to the case history.',
    route: '/templates',
    routeLabel: 'Manage Templates',
    icon: CheckCheck,
  },
  {
    title: 'Workspace settings and billing',
    description:
      'Set workspace identity, support email, timezone, SLA defaults, accepted request types, public copy, and plan-gated branding controls. Review plan limits and upgrade paths from Billing.',
    route: '/billing',
    routeLabel: 'Review Billing',
    icon: CreditCard,
  },
] as const

const prerequisites = [
  'A Stauxil account and access to the workspace.',
  'A support email address that your team monitors.',
  'A decision on which request types you want to accept.',
  'An email provider configured when you want verification delivery to send externally.',
] as const

const gettingStartedSteps = [
  {
    title: 'Review the workspace',
    items: [
      'Sign in and confirm that your workspace name is correct.',
      'Make sure the sidebar reflects the workspace you plan to use for request intake.',
    ],
  },
  {
    title: 'Configure Settings',
    items: [
      'Set the workspace name, support email, timezone, and default SLA days.',
      'Choose allowed request types and write the public intro and success copy.',
      'If your plan supports it, add the logo URL and brand color.',
    ],
  },
  {
    title: 'Check the public form preview',
    items: [
      'Review the preview card in Settings.',
      'Confirm the support email, SLA, branding, and request types are accurate.',
      'Open the public form in a new tab and verify that it loads correctly.',
    ],
  },
  {
    title: 'Review email templates',
    items: [
      'Open Templates and inspect each default category.',
      'Adjust subjects and body copy so the library matches your operational process.',
      'Enable the templates your team will need before live requests arrive.',
    ],
  },
  {
    title: 'Run a test request',
    items: [
      'Submit a request with your own email from the public form.',
      'Open the request from Dashboard or Requests and confirm the case ID, due date, and verification state.',
      'Use this test to confirm your verification workflow before sharing the public link broadly.',
    ],
  },
] as const

const workflowSteps = [
  {
    title: 'Publish the intake link',
    description:
      'Share the generated public request link on your website, privacy page, support center, or help desk content. Use the workspace-generated link exactly as shown.',
    icon: ShieldCheck,
  },
  {
    title: 'Open the request and review the record',
    description:
      'Start from Dashboard or Requests, then review the case ID, request type, status, verification status, submission date, due date, requester details, subject details, and current owner.',
    icon: FileText,
  },
  {
    title: 'Check verification status early',
    description:
      'Look for Pending, Verified, Expired, Failed, or Not required. If verification is missing, send a fresh verification email or mark the request verified manually when you handled it outside the normal flow.',
    icon: CheckCheck,
  },
  {
    title: 'Assign ownership and begin work',
    description:
      'Choose the responsible team member, save the owner, move the request to In progress, and add an internal note when the team needs more context.',
    icon: LayoutDashboard,
  },
  {
    title: 'Request more information or send a standard reply',
    description:
      'When details are missing, move the request to Waiting on requester, note what is missing, and use the email preview/log area to log the more-information-needed message or another standard template.',
    icon: AlertCircle,
  },
  {
    title: 'Close only after the record is complete',
    description:
      'Before closing as Completed, Rejected, or Cancelled, confirm that notes, owner assignment, and communication history are complete. Closed requests stay read-only in the current workflow.',
    icon: Clock3,
  },
] as const

const useCases = [
  {
    title: 'New deletion request',
    description:
      'A customer submits a deletion request, the first verification link expires, and the owner resends verification, assigns the case, moves it to In progress, logs the final response, and closes it as Completed.',
  },
  {
    title: 'Incomplete request',
    description:
      'A requester asks for access but does not include enough identifying information, so the team assigns the case, moves it to Waiting on requester, adds an internal note, and logs a more-information-needed message.',
  },
  {
    title: 'Monthly owner review',
    description:
      'The workspace is close to its monthly request limit, so the owner reviews Billing, exports the queue when available, checks overdue requests, and decides whether to upgrade before intake pauses.',
  },
] as const

const practiceCards = [
  {
    title: 'Run a steady review rhythm',
    items: [
      'Daily: check open and overdue counts, review the recent queue, and open requests due soon.',
      'Weekly: filter for overdue, unassigned, stalled, and waiting-on-requester cases.',
      'Monthly: review Billing, request volume, member usage, and export needs.',
    ],
    icon: Clock3,
  },
  {
    title: 'Avoid the most common mistakes',
    items: [
      'Do not close a request before notes and final communication are in the record.',
      'Assign an owner early so requests do not drift.',
      'Review verification status before the team starts work.',
      'Make sure templates are enabled before the team needs them.',
      'Watch plan limits so public intake does not pause unexpectedly.',
    ],
    icon: AlertTriangle,
  },
  {
    title: 'Keep the setup checklist current',
    items: [
      'Confirm workspace settings and template library before launch.',
      'Retest the public form and verification flow after major copy or branding changes.',
      'Keep notes and email logs current so the audit trail stays useful.',
    ],
    icon: Settings,
  },
] as const

const troubleshootingItems = [
  {
    title: 'Public intake is paused',
    cause: 'The workspace may have reached the monthly request limit for the current plan.',
    actions: [
      'Open Billing and review request usage and the active plan.',
      'Upgrade the workspace if you need more monthly capacity.',
    ],
  },
  {
    title: 'A verification link does not work',
    cause: 'The link may be expired, invalid, or already used.',
    actions: [
      'Open the request record and send a fresh verification email.',
      'Use manual verification only when you handled the verification another way.',
    ],
  },
  {
    title: 'CSV export is unavailable',
    cause: 'Exports are plan-gated.',
    actions: [
      'Check Billing to confirm whether exports are included on the current plan.',
      'Upgrade if exported request history is required.',
    ],
  },
  {
    title: 'Branding controls are blocked',
    cause: 'Custom branding is plan-gated.',
    actions: [
      'Review Billing to see whether custom branding is enabled.',
      'Upgrade if you need logo and brand color controls.',
    ],
  },
  {
    title: 'A timezone value is rejected',
    cause: 'Stauxil expects a valid IANA timezone string.',
    actions: [
      'Use values like America/New_York, Europe/London, or UTC.',
      'Save settings again after correcting the timezone.',
    ],
  },
  {
    title: 'A request will not move to the next status',
    cause: 'Only valid workflow transitions are allowed, and closed requests do not reopen in the current workflow.',
    actions: [
      'Review the current status and choose one of the available next statuses.',
      'If the request is already closed, keep the record as-is and create a new case if needed.',
    ],
  },
] as const

const faqItems = [
  {
    question: 'Do requesters need an account to submit a request?',
    answer: 'No. The public request form is designed for unauthenticated submission.',
  },
  {
    question: 'Can the workspace control accepted request types?',
    answer: 'Yes. Settings lets you choose which request types appear on the public form.',
  },
  {
    question: 'Can the public form be customized?',
    answer:
      'Yes. All workspaces can edit the public intro and success copy. Plans with custom branding can also change the logo and brand color.',
  },
  {
    question: 'Are all template emails sent externally?',
    answer:
      'No. In this MVP, verification is queued for provider delivery. Other template actions are logged inside Stauxil so the case history stays complete.',
  },
  {
    question: 'Can the request queue or case history be exported?',
    answer:
      'Yes, when the current plan includes exports. The Requests page supports CSV export and a single request can be printed as a case summary.',
  },
  {
    question: 'What should owners check most often?',
    answer:
      'Overdue requests, unassigned requests, verification status, and plan usage are the main watchpoints called out in the docs.',
  },
] as const

export function GuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(83,125,196,0.18),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,248,255,0.92))]">
        <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Workspace owner guide</Badge>
              <Badge variant="outline">Source-backed</Badge>
              <Badge variant="outline">MVP workflow</Badge>
            </div>

            <div className="flex max-w-3xl flex-col gap-4">
              <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Use Stauxil to manage privacy requests from intake through closure.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                This page condenses the repo documentation into a practical guide for workspace
                owners. It covers what the product does, where each core workflow lives, and how
                to keep request handling clear, timely, and well documented.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/settings">
                  Start in Settings
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/requests">Open Requests</Link>
              </Button>
            </div>
          </div>

          <Card className="border-white/70 bg-white/85 shadow-none">
            <CardHeader className="gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BookOpen />
                </div>
                <div>
                  <CardTitle>What this guide helps you answer</CardTitle>
                  <CardDescription>
                    Use it as a fast reference before launch and during day-to-day request
                    operations.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                'What should I configure first?',
                'How should a new request move through the app?',
                'What is plan-gated versus always available?',
                'Which issues should owners watch for most often?',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="border-t border-border/60 bg-white/60 px-6 py-4 sm:px-8">
          <nav aria-label="Guide sections" className="flex flex-wrap gap-2">
            {sectionLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full border border-border bg-background/90 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {heroHighlights.map((highlight) => (
          <HighlightCard key={highlight.title} {...highlight} />
        ))}
      </section>

      <section id="overview" className="scroll-mt-24">
        <SectionHeader
          eyebrow="Overview"
          title="A workflow tool for clear request handling"
          description="The docs consistently position Stauxil as a place to manage privacy request operations, track verification and deadlines, and maintain an audit trail without promising legal outcomes."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          {overviewCards.map((card) => (
            <ListCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      <section id="features" className="scroll-mt-24">
        <SectionHeader
          eyebrow="Key features"
          title="Where the core product workflows live"
          description="Each feature block below reflects the existing guide and design document rather than introducing new product promises."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <section id="getting-started" className="scroll-mt-24">
        <SectionHeader
          eyebrow="Getting started"
          title="Set up the workspace before real requests arrive"
          description="The owner guide puts setup first: configure the workspace, review the public form, confirm templates, and submit a test request before sharing the intake link."
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Card className="border-border/70 bg-muted/30">
            <CardHeader>
              <CardTitle>Before you start</CardTitle>
              <CardDescription>
                These prerequisites are called out directly in the docs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3">
                {prerequisites.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                    <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckCheck className="size-3.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {gettingStartedSteps.map((step, index) => (
              <NumberedCard
                key={step.title}
                number={index + 1}
                title={step.title}
                items={step.items}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24">
        <SectionHeader
          eyebrow="Step-by-step usage"
          title="Handle a request from intake to closure"
          description="This flow combines the publish, new request, verification, response, and close guidance into one operational sequence."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {workflowSteps.map((step, index) => (
            <WorkflowCard
              key={step.title}
              stepNumber={index + 1}
              title={step.title}
              description={step.description}
              icon={step.icon}
            />
          ))}
        </div>
      </section>

      <section id="use-cases" className="scroll-mt-24">
        <SectionHeader
          eyebrow="Use cases"
          title="Realistic owner scenarios from the docs"
          description="These examples show how the app is meant to be used day to day: verification recovery, incomplete requests, and monthly capacity review."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {useCases.map((useCase) => (
            <Card key={useCase.title} className="border-border/70">
              <CardHeader className="gap-3">
                <Badge variant="secondary" className="w-fit">
                  Example
                </Badge>
                <CardTitle>{useCase.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{useCase.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="tips" className="scroll-mt-24">
        <SectionHeader
          eyebrow="Tips / best practices"
          title="Keep the workspace healthy and predictable"
          description="The strongest recurring advice in the documentation is to keep ownership clear, watch verification early, and keep the record complete before closure."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {practiceCards.map((card) => (
            <PracticeCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      <section id="faq" className="scroll-mt-24">
        <SectionHeader
          eyebrow="Troubleshooting / FAQ"
          title="Answers for the issues owners will hit most often"
          description="These items are drawn directly from the guide's troubleshooting and FAQ sections and keep the language operational rather than legal."
        />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Troubleshooting</CardTitle>
              <CardDescription>
                Common blockers and the next action the guide recommends.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {troubleshootingItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="size-4" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          <span className="font-medium text-foreground">Cause:</span> {item.cause}
                        </p>
                      </div>
                      <ul className="grid gap-2">
                        {item.actions.map((action) => (
                          <li
                            key={action}
                            className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"
                          >
                            <CheckCheck className="mt-1 size-4 shrink-0 text-primary" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-muted/20">
            <CardHeader>
              <CardTitle>FAQ</CardTitle>
              <CardDescription>
                Short answers for common owner questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-2xl border border-border/70 bg-background p-4">
                  <p className="font-medium text-foreground">{item.question}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="border-border/70 bg-muted/30">
        <CardContent className="flex flex-col gap-5 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <p className="text-lg font-semibold tracking-tight">
              Ready to put the guide into practice?
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Most owners start in Settings, review Templates, run a test request, then manage
              live work from Dashboard and Requests.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/templates">Review Templates</Link>
            </Button>
            <Button asChild>
              <Link href="/settings">
                Open Settings
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="mb-4 flex max-w-3xl flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
    </div>
  )
}

function HighlightCard({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: GuideIcon
}) {
  return (
    <Card className="border-border/70 bg-background/95">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold tracking-tight">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ListCard({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: readonly string[]
}) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
              <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCheck className="size-3.5" />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function FeatureCard({
  title,
  description,
  route,
  routeLabel,
  icon: Icon,
}: {
  title: string
  description: string
  route: string
  routeLabel: string
  icon: GuideIcon
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-lg font-semibold tracking-tight">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="ghost" className="justify-start px-0">
          <Link href={route}>
            {routeLabel}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function NumberedCard({
  number,
  title,
  items,
}: {
  number: number
  title: string
  items: readonly string[]
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex gap-4 p-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <span className="text-base font-semibold">{number}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-base font-semibold tracking-tight">{title}</p>
          <ul className="grid gap-2">
            {items.map((item) => (
              <li key={item} className="text-sm leading-6 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

function WorkflowCard({
  stepNumber,
  title,
  description,
  icon: Icon,
}: {
  stepNumber: number
  title: string
  description: string
  icon: GuideIcon
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <Badge variant="secondary">Step {stepNumber}</Badge>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold tracking-tight">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function PracticeCard({
  title,
  items,
  icon: Icon,
}: {
  title: string
  items: readonly string[]
  icon: GuideIcon
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-lg font-semibold tracking-tight">{title}</p>
          <ul className="grid gap-3">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
