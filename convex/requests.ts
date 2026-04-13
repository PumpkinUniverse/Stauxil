import { v } from 'convex/values'
import { paginationOptsValidator, type PaginationOptions, type PaginationResult } from 'convex/server'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type QueryCtx } from './_generated/server'
import { assertWorkspaceCanCreateRequest, assertWorkspaceCanExport } from './lib/billing'
import { normalizeEmail, requireRequestAccess, requireWorkspaceAccess } from './lib/access'
import { insertRequestEvent } from './requestEvents'
import { issueVerificationToken, sendVerificationEmail } from './verification'
import {
  findWorkspaceBySlug,
  getPublicIntakeBlockerMessage,
  getWorkspacePublicIntakeConfig,
  getWorkspaceSlaSettings,
} from './workspaces'
import {
  activeRequestStatusValidator,
  closedRequestStatusValidator,
  requestStatusValidator,
  requestTypeValidator,
  verificationStatusValidator,
} from './validators'

type RequestStatus = Doc<'requests'>['status']

const CLOSED_REQUEST_STATUSES = ['completed', 'rejected', 'cancelled'] as const
const CLOSED_REQUEST_STATUS_SET = new Set<RequestStatus>(CLOSED_REQUEST_STATUSES)
const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  received: ['in_progress', 'waiting_on_requester'],
  in_progress: ['waiting_on_requester'],
  waiting_on_requester: ['in_progress'],
  completed: [],
  rejected: [],
  cancelled: [],
}

export const listByWorkspace = query({
  args: {
    workspaceId: v.id('workspaces'),
    status: v.optional(requestStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100)
    const status = args.status

    if (status !== undefined) {
      return await ctx.db
        .query('requests')
        .withIndex('by_workspace_id_and_status', (q) =>
          q.eq('workspaceId', args.workspaceId).eq('status', status)
        )
        .order('desc')
        .take(limit)
    }

    return await ctx.db
      .query('requests')
      .withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')
      .take(limit)
  },
})

export const get = query({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
  },
  handler: async (ctx, args) => {
    const { request } = await requireRequestAccess(ctx, args.workspaceId, args.requestId)
    return request
  },
})

export const getDetailByCaseId = query({
  args: {
    workspaceId: v.id('workspaces'),
    caseId: v.string(),
    eventLimit: v.optional(v.number()),
    noteLimit: v.optional(v.number()),
    emailLogLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)

    const caseId = args.caseId.trim().toUpperCase()
    if (!caseId) {
      return null
    }

    const request = await ctx.db
      .query('requests')
      .withIndex('by_workspace_id_and_case_id', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('caseId', caseId)
      )
      .unique()

    if (request === null || request.archivedAt !== null) {
      return null
    }

    const members = await listWorkspaceMembers(ctx, args.workspaceId)

    members.sort((left, right) => {
      const roleComparison =
        getMemberRolePriority(left.role) - getMemberRolePriority(right.role)

      if (roleComparison !== 0) {
        return roleComparison
      }

      return getMemberDisplayName(left).localeCompare(getMemberDisplayName(right))
    })

    const memberMap = new Map(members.map((member) => [member._id, member] as const))
    const assignedMember =
      request.assignedMemberId === null ? null : memberMap.get(request.assignedMemberId) ?? null

    const eventLimit = Math.min(Math.max(args.eventLimit ?? 20, 1), 50)
    const events = await ctx.db
      .query('requestEvents')
      .withIndex('by_workspace_id_and_request_id', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('requestId', request._id)
      )
      .order('desc')
      .take(eventLimit)
    const closedAt = getClosedAtTimestamp(request, events)

    const noteLimit = Math.min(Math.max(args.noteLimit ?? 20, 1), 50)
    const notes = await ctx.db
      .query('requestNotes')
      .withIndex('by_workspace_id_and_request_id', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('requestId', request._id)
      )
      .order('desc')
      .take(noteLimit)

    const emailLogLimit = Math.min(Math.max(args.emailLogLimit ?? 20, 1), 50)
    const emailLogs = await ctx.db
      .query('emailLogs')
      .withIndex('by_workspace_id_and_request_id', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('requestId', request._id)
      )
      .order('desc')
      .take(emailLogLimit)

    return {
      request: {
        id: request._id,
        caseId: request.caseId ?? formatCaseId(request._id),
        title: request.title,
        description: request.description,
        requestType: request.requestType,
        status: request.status,
        verificationStatus: request.verificationStatus,
        jurisdiction: request.jurisdiction ?? null,
        accountReference: request.accountReference ?? null,
        dueAt: request.dueAt,
        submittedAt: request.submittedAt,
        verifiedAt: request.verifiedAt,
        closedAt,
        completedAt: request.completedAt,
        isClosed: CLOSED_REQUEST_STATUS_SET.has(request.status),
        requester: {
          name: request.requesterName,
          email: request.requesterEmail ?? request.subjectEmail,
        },
        subject: {
          name: request.subjectName,
          email: request.subjectEmail,
        },
        owner:
          assignedMember === null
            ? null
            : {
                id: assignedMember._id,
                name: assignedMember.name,
                email: assignedMember.email,
                role: assignedMember.role,
              },
      },
      members: members.map((member) => ({
        id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
      })),
      availableStatusTransitions: getAvailableStatusTransitions(request.status),
      availableCloseStatuses: [...CLOSED_REQUEST_STATUSES],
      notes: notes.map((note) => {
        const authorMember = memberMap.get(note.authorMemberId) ?? null

        return {
          id: note._id,
          createdAt: note._creationTime,
          body: note.body,
          isInternal: note.isInternal,
          authorLabel: authorMember ? getMemberDisplayName(authorMember) : 'Unknown member',
        }
      }),
      events: events.map((event) => {
        const actorMember =
          event.actorMemberId === null ? null : memberMap.get(event.actorMemberId) ?? null

        return {
          id: event._id,
          createdAt: event._creationTime,
          actorType: event.actorType,
          actorLabel: getActorLabel(event.actorType, actorMember),
          eventType: event.eventType,
          message: event.message,
          details: event.details ?? null,
        }
      }),
      emailLogs: emailLogs.map((emailLog) => {
        const createdByMember =
          emailLog.createdByMemberId === null
            ? null
            : memberMap.get(emailLog.createdByMemberId) ?? null

        return {
          id: emailLog._id,
          createdAt: emailLog._creationTime,
          sentAt: emailLog.sentAt,
          toEmail: emailLog.toEmail,
          fromEmail: emailLog.fromEmail ?? null,
          replyToEmail: emailLog.replyToEmail ?? null,
          senderSource: emailLog.senderSource ?? null,
          providerName: emailLog.providerName ?? null,
          subject: emailLog.subject,
          body: emailLog.body,
          status: emailLog.status,
          deliveryMode: emailLog.deliveryMode ?? null,
          templateKey: emailLog.templateKey,
          templateLabel: formatTemplateKeyLabel(emailLog.templateKey),
          createdByLabel:
            createdByMember === null
              ? emailLog.createdByMemberId === null
                ? 'System'
                : 'Unknown member'
              : getMemberDisplayName(createdByMember),
          errorMessage: emailLog.errorMessage,
        }
      }),
    }
  },
})

export const exportByWorkspace = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAccess(ctx, args.workspaceId)
    await assertWorkspaceCanExport(ctx, workspace)
    const requests: Doc<'requests'>[] = []

    for await (const request of ctx.db
      .query('requests')
      .withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')) {
      if (request.archivedAt !== null) {
        continue
      }

      requests.push(request)
    }

    const rows = await Promise.all(
      requests.map(async (request) => {
        const eventLimit =
          request.completedAt === null && CLOSED_REQUEST_STATUS_SET.has(request.status) ? 25 : 6
        const recentEvents = await ctx.db
          .query('requestEvents')
          .withIndex('by_workspace_id_and_request_id', (q) =>
            q.eq('workspaceId', args.workspaceId).eq('requestId', request._id)
          )
          .order('desc')
          .take(eventLimit)

        const recentNotes = await ctx.db
          .query('requestNotes')
          .withIndex('by_workspace_id_and_request_id', (q) =>
            q.eq('workspaceId', args.workspaceId).eq('requestId', request._id)
          )
          .order('desc')
          .take(3)

        const recentEmailLogs = await ctx.db
          .query('emailLogs')
          .withIndex('by_workspace_id_and_request_id', (q) =>
            q.eq('workspaceId', args.workspaceId).eq('requestId', request._id)
          )
          .order('desc')
          .take(3)

        return {
          caseId: request.caseId ?? formatCaseId(request._id),
          title: request.title,
          requesterLabel: getRequesterLabel(request),
          requesterEmail: getRequesterEmail(request),
          requestType: request.requestType,
          requestTypeLabel: formatRequestTypeLabel(request.requestType),
          status: request.status,
          statusLabel: formatRequestStatusLabel(request.status),
          verificationStatus: request.verificationStatus,
          verificationStatusLabel: formatVerificationStatusLabel(request.verificationStatus),
          dueAt: request.dueAt,
          createdAt: request.submittedAt,
          closedAt: getClosedAtTimestamp(request, recentEvents),
          notesSummary: createExportNotesSummary(recentNotes),
          emailSummary: createExportEmailSummary(recentEmailLogs),
          timelineSummary: createExportTimelineSummary(recentEvents),
        }
      })
    )

    return {
      workspaceName: workspace.name,
      exportedAt: Date.now(),
      rows,
    }
  },
})

export const dashboardSnapshot = query({
  args: {
    workspaceId: v.id('workspaces'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)

    const limit = Math.min(Math.max(args.limit ?? 12, 1), 25)
    const now = Date.now()
    const startOfToday = getStartOfUtcDay(now)
    const startOfNextWeek = startOfToday + 7 * 24 * 60 * 60 * 1000
    const startOfMonth = getStartOfUtcMonth(now)

    const recentRequests: Doc<'requests'>[] = []
    const assignedMemberIds = new Set<Id<'workspaceMembers'>>()

    let openRequests = 0
    let overdueRequests = 0
    let dueThisWeek = 0
    let fulfilledThisMonth = 0

    for await (const request of ctx.db
      .query('requests')
      .withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')) {
      if (request.archivedAt !== null) {
        continue
      }

      const isClosed = CLOSED_REQUEST_STATUS_SET.has(request.status)

      if (!isClosed) {
        openRequests += 1
      }

      if (!isClosed && request.dueAt !== null && request.dueAt < now) {
        overdueRequests += 1
      }

      if (
        !isClosed &&
        request.dueAt !== null &&
        request.dueAt >= startOfToday &&
        request.dueAt < startOfNextWeek
      ) {
        dueThisWeek += 1
      }

      if (request.completedAt !== null && request.completedAt >= startOfMonth) {
        fulfilledThisMonth += 1
      }

      if (recentRequests.length >= limit) {
        continue
      }

      recentRequests.push(request)

      if (request.assignedMemberId !== null) {
        assignedMemberIds.add(request.assignedMemberId)
      }
    }

    const uniqueAssignedMemberIds = Array.from(assignedMemberIds)
    const assignedMembers = await Promise.all(
      uniqueAssignedMemberIds.map(async (memberId) => {
        const member = await ctx.db.get(memberId)
        return member ? { memberId, member } : null
      })
    )

    const assignedMemberMap = new Map<Id<'workspaceMembers'>, Doc<'workspaceMembers'>>()
    for (const entry of assignedMembers) {
      if (entry !== null) {
        assignedMemberMap.set(entry.memberId, entry.member)
      }
    }

    return {
      summary: {
        openRequests,
        overdueRequests,
        dueThisWeek,
        fulfilledThisMonth,
      },
      requests: recentRequests.map((request) => {
        const isClosed = CLOSED_REQUEST_STATUS_SET.has(request.status)
        const assignedMember =
          request.assignedMemberId === null
            ? null
            : assignedMemberMap.get(request.assignedMemberId) ?? null

        return {
          id: request._id,
          caseId: request.caseId ?? formatCaseId(request._id),
          title: request.title,
          requesterName:
            request.requesterName ??
            request.subjectName ??
            request.requesterEmail ??
            request.subjectEmail,
          requesterEmail: request.requesterEmail ?? request.subjectEmail,
          type: request.requestType,
          status: request.status,
          verificationStatus: request.verificationStatus,
          ownerName: assignedMember?.name ?? assignedMember?.email ?? null,
          dueAt: request.dueAt,
          isClosed,
        }
      }),
    }
  },
})

export const getInboxMetadata = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)

    const members = await listWorkspaceMembers(ctx, args.workspaceId)
    const now = Date.now()

    let totalRequests = 0
    let openRequests = 0
    let overdueRequests = 0

    for await (const request of ctx.db
      .query('requests')
      .withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')) {
      if (request.archivedAt !== null) {
        continue
      }

      totalRequests += 1

      const isClosed = CLOSED_REQUEST_STATUS_SET.has(request.status)
      if (!isClosed) {
        openRequests += 1
      }

      if (!isClosed && request.dueAt !== null && request.dueAt < now) {
        overdueRequests += 1
      }
    }

    return {
      summary: {
        totalRequests,
        openRequests,
        overdueRequests,
      },
      owners: members.map((member) => ({
        id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
      })),
    }
  },
})

export const listInboxPage = query({
  args: {
    workspaceId: v.id('workspaces'),
    paginationOpts: paginationOptsValidator,
    status: v.optional(requestStatusValidator),
    assignedMemberId: v.optional(v.union(v.id('workspaceMembers'), v.null())),
    requestType: v.optional(requestTypeValidator),
    overdueOnly: v.optional(v.boolean()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)

    if (args.assignedMemberId !== undefined && args.assignedMemberId !== null) {
      const assignedMember = await ctx.db.get(args.assignedMemberId)
      if (assignedMember === null || assignedMember.workspaceId !== args.workspaceId) {
        throw new Error('Assigned owner not found in this workspace.')
      }
    }

    const filters = normalizeInboxFilters(args)
    const page = await paginateInboxRequests(ctx, args.workspaceId, filters, args.paginationOpts)
    const assignedMemberIds = Array.from(
      new Set(
        page.page
          .map((request) => request.assignedMemberId)
          .filter((memberId): memberId is Id<'workspaceMembers'> => memberId !== null)
      )
    )

    const assignedMembers = await Promise.all(
      assignedMemberIds.map(async (memberId) => {
        const member = await ctx.db.get(memberId)
        return member && member.workspaceId === args.workspaceId ? ([memberId, member] as const) : null
      })
    )

    const assignedMemberMap = new Map<Id<'workspaceMembers'>, Doc<'workspaceMembers'>>()
    for (const entry of assignedMembers) {
      if (entry !== null) {
        assignedMemberMap.set(entry[0], entry[1])
      }
    }

    return {
      ...page,
      page: page.page.map((request) => {
        const assignedMember =
          request.assignedMemberId === null
            ? null
            : assignedMemberMap.get(request.assignedMemberId) ?? null

        return {
          id: request._id,
          caseId: request.caseId ?? formatCaseId(request._id),
          title: request.title,
          requesterName: getRequesterLabel(request),
          requesterEmail: getRequesterEmail(request),
          type: request.requestType,
          status: request.status,
          verificationStatus: request.verificationStatus,
          ownerName: assignedMember?.name ?? assignedMember?.email ?? null,
          dueAt: request.dueAt,
          isClosed: CLOSED_REQUEST_STATUS_SET.has(request.status),
          lastEventAt: request.lastEventAt,
        }
      }),
    }
  },
})

export const create = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestType: requestTypeValidator,
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    jurisdiction: v.optional(v.union(v.string(), v.null())),
    accountReference: v.optional(v.union(v.string(), v.null())),
    subjectEmail: v.string(),
    subjectName: v.optional(v.union(v.string(), v.null())),
    requesterEmail: v.optional(v.union(v.string(), v.null())),
    requesterName: v.optional(v.union(v.string(), v.null())),
    dueAt: v.optional(v.union(v.number(), v.null())),
    status: v.optional(requestStatusValidator),
    verificationStatus: v.optional(verificationStatusValidator),
  },
  handler: async (ctx, args) => {
    const { membership, workspace } = await requireWorkspaceAccess(ctx, args.workspaceId)
    const title = args.title.trim()
    const subjectEmail = normalizeEmail(args.subjectEmail)
    const requesterEmail = normalizeOptionalEmailAddress(args.requesterEmail)

    if (!title) {
      throw new Error('Request title is required')
    }

    assertValidEmailAddress(subjectEmail, 'subject')

    await assertWorkspaceCanCreateRequest(ctx, workspace)

    const now = Date.now()
    const requestId = await ctx.db.insert('requests', {
      workspaceId: args.workspaceId,
      requestType: args.requestType,
      status: args.status ?? 'received',
      verificationStatus: args.verificationStatus ?? 'not_required',
      title,
      description: args.description ?? null,
      jurisdiction: args.jurisdiction ?? null,
      accountReference: args.accountReference ?? null,
      subjectEmail,
      subjectName: args.subjectName ?? null,
      requesterEmail,
      requesterName: args.requesterName ?? null,
      dueAt: args.dueAt ?? null,
      submittedAt: now,
      verifiedAt: null,
      lastEventAt: now,
      createdByMemberId: membership._id,
      assignedMemberId: null,
      completedAt: null,
      archivedAt: null,
    })
    const caseId = formatCaseId(requestId)

    await ctx.db.patch(requestId, { caseId })

    await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId,
      actorType: 'member',
      actorMemberId: membership._id,
      eventType: 'request_created',
      message: 'Created the request',
      details: {
        caseId,
        requestType: args.requestType,
        status: args.status ?? 'received',
      },
    })

    return requestId
  },
})

export const createPublicRequest = mutation({
  args: {
    workspaceSlug: v.string(),
    fullName: v.string(),
    email: v.string(),
    requestType: requestTypeValidator,
    jurisdiction: v.string(),
    accountReference: v.optional(v.union(v.string(), v.null())),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await findWorkspaceBySlug(ctx, args.workspaceSlug)

    if (workspace === null) {
      throw new Error('This request form is not available.')
    }

    const publicIntakeBlockerMessage = getPublicIntakeBlockerMessage(workspace)
    if (publicIntakeBlockerMessage !== null) {
      throw new Error(publicIntakeBlockerMessage)
    }

    const fullName = args.fullName.trim()
    const details = args.details.trim()
    const jurisdiction = args.jurisdiction.trim()
    const accountReference = args.accountReference?.trim() || null

    if (!fullName) {
      throw new Error('Full name is required.')
    }

    if (!isValidEmailAddress(args.email)) {
      throw new Error('Enter a valid email address.')
    }

    if (!details) {
      throw new Error('Request details are required.')
    }

    if (!jurisdiction) {
      throw new Error('Jurisdiction or region is required.')
    }

    if (details.length < 20) {
      throw new Error('Add a bit more detail so the request can be routed correctly.')
    }

    if (accountReference !== null && accountReference.length > 120) {
      throw new Error('Keep the reference under 120 characters.')
    }

    const allowedRequestTypes = new Set(getWorkspacePublicIntakeConfig(workspace).allowedRequestTypes)
    if (!allowedRequestTypes.has(args.requestType)) {
      throw new Error('Select a valid request type.')
    }

    await assertWorkspaceCanCreateRequest(ctx, workspace)

    const { defaultSlaDays, publicRequestInitialStatus } = getWorkspaceSlaSettings(workspace)
    const now = Date.now()
    const dueAt = addDays(now, defaultSlaDays)
    const title = createPublicRequestTitle(args.requestType, fullName)

    const requestId = await ctx.db.insert('requests', {
      workspaceId: workspace._id,
      requestType: args.requestType,
      status: publicRequestInitialStatus,
      verificationStatus: 'pending',
      title,
      description: details,
      jurisdiction,
      accountReference,
      subjectEmail: normalizeEmail(args.email),
      subjectName: fullName,
      requesterEmail: normalizeEmail(args.email),
      requesterName: fullName,
      dueAt,
      submittedAt: now,
      verifiedAt: null,
      lastEventAt: now,
      createdByMemberId: null,
      assignedMemberId: null,
      completedAt: null,
      archivedAt: null,
    })

    const caseId = formatCaseId(requestId)
    await ctx.db.patch(requestId, { caseId })

    await insertRequestEvent(ctx, {
      workspaceId: workspace._id,
      requestId,
      actorType: 'requester',
      actorMemberId: null,
      eventType: 'public_request_submitted',
      message: 'Submitted a new privacy request',
      details: {
        caseId,
        requestType: args.requestType,
        status: publicRequestInitialStatus,
      },
    })

    const request = await ctx.db.get(requestId)
    if (request === null) {
      throw new Error('Failed to load the request after creation.')
    }

    const issuedToken = await issueVerificationToken(ctx, {
      workspace,
      request,
      email: request.requesterEmail ?? request.subjectEmail,
      createdByMemberId: null,
      actorType: 'system',
    })

    await sendVerificationEmail(ctx, {
      workspace,
      request,
      email: issuedToken.email,
      tokenId: issuedToken.tokenId,
      token: issuedToken.token,
      expiresAt: issuedToken.expiresAt,
      createdByMemberId: null,
    })

    return {
      requestId,
      caseId,
      workspaceSlug: workspace.slug ?? args.workspaceSlug,
    }
  },
})

export const updateDetails = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    requestType: v.optional(requestTypeValidator),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    jurisdiction: v.optional(v.union(v.string(), v.null())),
    accountReference: v.optional(v.union(v.string(), v.null())),
    subjectEmail: v.optional(v.string()),
    subjectName: v.optional(v.union(v.string(), v.null())),
    requesterEmail: v.optional(v.union(v.string(), v.null())),
    requesterName: v.optional(v.union(v.string(), v.null())),
    dueAt: v.optional(v.union(v.number(), v.null())),
    assignedMemberId: v.optional(v.union(v.id('workspaceMembers'), v.null())),
  },
  handler: async (ctx, args) => {
    const { membership, request } = await requireRequestAccess(
      ctx,
      args.workspaceId,
      args.requestId
    )

    const patch: {
      requestType?: (typeof args.requestType)
      title?: string
      description?: string | null
      jurisdiction?: string | null
      accountReference?: string | null
      subjectEmail?: string
      subjectName?: string | null
      requesterEmail?: string | null
      requesterName?: string | null
      dueAt?: number | null
      assignedMemberId?: typeof args.assignedMemberId
    } = {}

    if (args.requestType !== undefined) {
      patch.requestType = args.requestType
    }

    if (args.title !== undefined) {
      const title = args.title.trim()
      if (!title) {
        throw new Error('Request title is required')
      }

      patch.title = title
    }

    if (args.description !== undefined) {
      patch.description = args.description
    }

    if (args.jurisdiction !== undefined) {
      patch.jurisdiction = args.jurisdiction
    }

    if (args.accountReference !== undefined) {
      patch.accountReference = args.accountReference
    }

    if (args.subjectEmail !== undefined) {
      const subjectEmail = normalizeEmail(args.subjectEmail)
      assertValidEmailAddress(subjectEmail, 'subject')
      patch.subjectEmail = subjectEmail
    }

    if (args.subjectName !== undefined) {
      patch.subjectName = args.subjectName
    }

    if (args.requesterEmail !== undefined) {
      patch.requesterEmail = normalizeOptionalEmailAddress(args.requesterEmail)
    }

    if (args.requesterName !== undefined) {
      patch.requesterName = args.requesterName
    }

    if (args.dueAt !== undefined) {
      patch.dueAt = args.dueAt
    }

    if (args.assignedMemberId !== undefined) {
      if (args.assignedMemberId !== null) {
        const assignedMember = await ctx.db.get(args.assignedMemberId)
        if (assignedMember === null || assignedMember.workspaceId !== args.workspaceId) {
          throw new Error('Assigned member not found')
        }
      }

      patch.assignedMemberId = args.assignedMemberId
    }

    await ctx.db.patch(request._id, patch)
    await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      actorType: 'member',
      actorMemberId: membership._id,
      eventType: 'request_updated',
      message: 'Updated request details',
    })

    return request._id
  },
})

export const updateStatus = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    status: activeRequestStatusValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { membership, request } = await requireRequestAccess(
      ctx,
      args.workspaceId,
      args.requestId
    )

    if (request.status === args.status) {
      return request._id
    }

    if (CLOSED_REQUEST_STATUS_SET.has(request.status)) {
      throw new Error('Closed requests cannot move to a new working status.')
    }

    if (!getAvailableStatusTransitions(request.status).includes(args.status)) {
      throw new Error(
        `Requests in ${formatRequestStatusLabel(request.status)} can only move to ${formatStatusList(
          getAvailableStatusTransitions(request.status)
        )}.`
      )
    }

    await ctx.db.patch(request._id, {
      status: args.status,
      completedAt: null,
    })

    await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      actorType: 'member',
      actorMemberId: membership._id,
      eventType: 'status_changed',
      message: createTransitionMessage('Changed status to', args.status, args.note),
      details: {
        previousStatus: request.status,
        nextStatus: args.status,
      },
    })

    return request._id
  },
})

export const assignOwner = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    assignedMemberId: v.union(v.id('workspaceMembers'), v.null()),
  },
  handler: async (ctx, args) => {
    const { membership, request } = await requireRequestAccess(
      ctx,
      args.workspaceId,
      args.requestId
    )

    if (request.assignedMemberId === args.assignedMemberId) {
      return request._id
    }

    const previousOwner =
      request.assignedMemberId === null ? null : await ctx.db.get(request.assignedMemberId)

    let nextOwner: Doc<'workspaceMembers'> | null = null
    if (args.assignedMemberId !== null) {
      nextOwner = await ctx.db.get(args.assignedMemberId)

      if (nextOwner === null || nextOwner.workspaceId !== args.workspaceId) {
        throw new Error('Assigned owner not found in this workspace.')
      }
    }

    await ctx.db.patch(request._id, {
      assignedMemberId: args.assignedMemberId,
    })

    const previousOwnerLabel = previousOwner ? getMemberDisplayName(previousOwner) : 'Unassigned'
    const nextOwnerLabel = nextOwner ? getMemberDisplayName(nextOwner) : 'Unassigned'

    await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      actorType: 'member',
      actorMemberId: membership._id,
      eventType: nextOwner ? 'owner_assigned' : 'owner_unassigned',
      message: nextOwner
        ? `Assigned ${nextOwnerLabel} as the request owner`
        : 'Cleared the assigned request owner',
      details: {
        previousOwner: previousOwnerLabel,
        nextOwner: nextOwnerLabel,
      },
    })

    return request._id
  },
})

export const closeRequest = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    status: closedRequestStatusValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { membership, request } = await requireRequestAccess(
      ctx,
      args.workspaceId,
      args.requestId
    )

    if (request.status === args.status) {
      return request._id
    }

    if (CLOSED_REQUEST_STATUS_SET.has(request.status)) {
      throw new Error('This request is already closed.')
    }

    const now = Date.now()
    await ctx.db.patch(request._id, {
      status: args.status,
      completedAt: args.status === 'completed' ? now : null,
    })

    await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      actorType: 'member',
      actorMemberId: membership._id,
      eventType: 'request_closed',
      message: createTransitionMessage('Closed request as', args.status, args.note),
      details: {
        previousStatus: request.status,
        nextStatus: args.status,
      },
    })

    return request._id
  },
})

function getStartOfUtcDay(timestamp: number) {
  const date = new Date(timestamp)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime()
}

function getStartOfUtcMonth(timestamp: number) {
  const date = new Date(timestamp)
  date.setUTCDate(1)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime()
}

type InboxFilters = {
  status?: RequestStatus
  assignedMemberId?: Id<'workspaceMembers'> | null
  requestType?: Doc<'requests'>['requestType']
  overdueOnly: boolean
  search: string
  normalizedSearch: string
  caseIdSearch: string
  emailSearch: string
  searchMode: 'none' | 'caseIdPrefix' | 'requesterEmailPrefix'
}

async function listWorkspaceMembers(ctx: QueryCtx, workspaceId: Id<'workspaces'>) {
  const members: Doc<'workspaceMembers'>[] = []

  for await (const member of ctx.db
    .query('workspaceMembers')
    .withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId))) {
    members.push(member)
  }

  members.sort((left, right) => {
    const roleComparison = getMemberRolePriority(left.role) - getMemberRolePriority(right.role)
    if (roleComparison !== 0) {
      return roleComparison
    }

    return getMemberDisplayName(left).localeCompare(getMemberDisplayName(right))
  })

  return members
}

function normalizeInboxFilters(args: {
  status?: RequestStatus
  assignedMemberId?: Id<'workspaceMembers'> | null
  requestType?: Doc<'requests'>['requestType']
  overdueOnly?: boolean
  search?: string
}): InboxFilters {
  const rawSearch = args.search?.trim() ?? ''
  const normalizedSearch = rawSearch.toLowerCase()
  const compactSearch = rawSearch.toUpperCase().replace(/\s+/g, '')
  const caseIdSearch = compactSearch.startsWith('REQ')
    ? compactSearch.startsWith('REQ-')
      ? compactSearch
      : compactSearch.replace(/^REQ/, 'REQ-')
    : compactSearch
  const emailSearch = normalizeEmail(rawSearch)

  let searchMode: InboxFilters['searchMode'] = 'none'
  if (rawSearch.length >= 3) {
    if (rawSearch.includes('@')) {
      searchMode = 'requesterEmailPrefix'
    } else if (caseIdSearch.startsWith('REQ-')) {
      searchMode = 'caseIdPrefix'
    }
  }

  return {
    status: args.status,
    assignedMemberId: args.assignedMemberId,
    requestType: args.requestType,
    overdueOnly: args.overdueOnly ?? false,
    search: rawSearch,
    normalizedSearch,
    caseIdSearch,
    emailSearch,
    searchMode,
  }
}

async function paginateInboxRequests(
  ctx: QueryCtx,
  workspaceId: Id<'workspaces'>,
  filters: InboxFilters,
  paginationOpts: PaginationOptions
): Promise<PaginationResult<Doc<'requests'>>> {
  const targetItems = Math.min(Math.max(Math.floor(paginationOpts.numItems), 1), 100)
  const maximumRowsRead = Math.min(
    Math.max(paginationOpts.maximumRowsRead ?? targetItems * 12, targetItems * 4),
    400
  )
  const now = Date.now()

  const page: Doc<'requests'>[] = []
  let cursor = paginationOpts.cursor
  let continueCursor = paginationOpts.cursor ?? ''
  let isDone = false
  let rowsRead = 0

  while (page.length < targetItems && !isDone && rowsRead < maximumRowsRead) {
    const remaining = targetItems - page.length
    const batchSize = Math.min(Math.max(remaining * 3, 20), 100)
    const batch = await getInboxRequestBatch(ctx, workspaceId, filters, {
      ...paginationOpts,
      cursor,
      numItems: batchSize,
      maximumRowsRead: Math.min(maximumRowsRead - rowsRead, batchSize * 6),
    })

    cursor = batch.continueCursor
    continueCursor = batch.continueCursor
    isDone = batch.isDone
    rowsRead += batch.page.length

    for (const request of batch.page) {
      if (matchesInboxFilters(request, filters, now)) {
        page.push(request)
      }

      if (page.length >= targetItems) {
        break
      }
    }
  }

  return {
    page,
    isDone,
    continueCursor,
  }
}

async function getInboxRequestBatch(
  ctx: QueryCtx,
  workspaceId: Id<'workspaces'>,
  filters: InboxFilters,
  paginationOpts: PaginationOptions
) {
  if (filters.searchMode === 'requesterEmailPrefix') {
    return await ctx.db
      .query('requests')
      .withIndex('by_workspace_id_and_requester_email', (q) =>
        q
          .eq('workspaceId', workspaceId)
          .gte('requesterEmail', filters.emailSearch)
          .lt('requesterEmail', `${filters.emailSearch}\uffff`)
      )
      .paginate(paginationOpts)
  }

  if (filters.searchMode === 'caseIdPrefix') {
    return await ctx.db
      .query('requests')
      .withIndex('by_workspace_id_and_case_id', (q) =>
        q
          .eq('workspaceId', workspaceId)
          .gte('caseId', filters.caseIdSearch)
          .lt('caseId', `${filters.caseIdSearch}\uffff`)
      )
      .paginate(paginationOpts)
  }

  if (filters.overdueOnly) {
    return await ctx.db
      .query('requests')
      .withIndex('by_workspace_id_and_due_at', (q) =>
        q.eq('workspaceId', workspaceId).gte('dueAt', 0).lt('dueAt', Date.now())
      )
      .order('asc')
      .paginate(paginationOpts)
  }

  const assignedMemberId = filters.assignedMemberId
  if (assignedMemberId !== undefined) {
    return await ctx.db
      .query('requests')
      .withIndex('by_workspace_id_and_assigned_member_id_and_last_event_at', (q) =>
        q.eq('workspaceId', workspaceId).eq('assignedMemberId', assignedMemberId)
      )
      .order('desc')
      .paginate(paginationOpts)
  }

  const status = filters.status
  if (status !== undefined) {
    return await ctx.db
      .query('requests')
      .withIndex('by_workspace_id_and_status_and_last_event_at', (q) =>
        q.eq('workspaceId', workspaceId).eq('status', status)
      )
      .order('desc')
      .paginate(paginationOpts)
  }

  const requestType = filters.requestType
  if (requestType !== undefined) {
    return await ctx.db
      .query('requests')
      .withIndex('by_workspace_id_and_request_type_and_last_event_at', (q) =>
        q.eq('workspaceId', workspaceId).eq('requestType', requestType)
      )
      .order('desc')
      .paginate(paginationOpts)
  }

  return await ctx.db
    .query('requests')
    .withIndex('by_workspace_id_and_last_event_at', (q) => q.eq('workspaceId', workspaceId))
    .order('desc')
    .paginate(paginationOpts)
}

function matchesInboxFilters(request: Doc<'requests'>, filters: InboxFilters, now: number) {
  if (request.archivedAt !== null) {
    return false
  }

  if (filters.status !== undefined && request.status !== filters.status) {
    return false
  }

  if (
    filters.assignedMemberId !== undefined &&
    request.assignedMemberId !== filters.assignedMemberId
  ) {
    return false
  }

  if (filters.requestType !== undefined && request.requestType !== filters.requestType) {
    return false
  }

  if (
    filters.overdueOnly &&
    (CLOSED_REQUEST_STATUS_SET.has(request.status) || request.dueAt === null || request.dueAt >= now)
  ) {
    return false
  }

  if (!filters.search) {
    return true
  }

  const caseId = (request.caseId ?? formatCaseId(request._id)).toLowerCase()
  const requesterEmail = getRequesterEmail(request).toLowerCase()

  return (
    caseId.includes(filters.normalizedSearch) || requesterEmail.includes(filters.normalizedSearch)
  )
}

function addDays(timestamp: number, dayCount: number) {
  return timestamp + dayCount * 24 * 60 * 60 * 1000
}

function createPublicRequestTitle(requestType: Doc<'requests'>['requestType'], fullName: string) {
  return `${formatRequestTypeLabel(requestType)} request from ${fullName}`
}

function getAvailableStatusTransitions(status: RequestStatus) {
  return STATUS_TRANSITIONS[status]
}

function createTransitionMessage(prefix: string, status: RequestStatus, note?: string) {
  const trimmedNote = note?.trim()
  const baseMessage = `${prefix} ${formatRequestStatusLabel(status)}`

  return trimmedNote ? `${baseMessage}. ${trimmedNote}` : baseMessage
}

function formatStatusList(statuses: RequestStatus[]) {
  if (statuses.length === 0) {
    return 'no further working statuses'
  }

  return statuses.map(formatRequestStatusLabel).join(', ')
}

function getClosedAtTimestamp(
  request: Pick<Doc<'requests'>, 'status' | 'completedAt'>,
  events: Array<Pick<Doc<'requestEvents'>, 'eventType' | '_creationTime'>>
) {
  if (request.completedAt !== null) {
    return request.completedAt
  }

  if (!CLOSED_REQUEST_STATUS_SET.has(request.status)) {
    return null
  }

  const closeEvent = events.find((event) => event.eventType === 'request_closed')
  return closeEvent?._creationTime ?? null
}

function getActorLabel(actorType: string, member: Doc<'workspaceMembers'> | null) {
  if (member !== null) {
    return getMemberDisplayName(member)
  }

  if (actorType === 'requester') {
    return 'Requester'
  }

  if (actorType === 'system') {
    return 'System'
  }

  return 'Team member'
}

function getMemberDisplayName(member: Pick<Doc<'workspaceMembers'>, 'name' | 'email'>) {
  return member.name?.trim() || member.email?.trim() || 'Unknown member'
}

function getRequesterLabel(
  request: Pick<
    Doc<'requests'>,
    'requesterName' | 'subjectName' | 'requesterEmail' | 'subjectEmail'
  >
) {
  return (
    request.requesterName?.trim() ||
    request.subjectName?.trim() ||
    request.requesterEmail?.trim() ||
    request.subjectEmail
  )
}

function getRequesterEmail(
  request: Pick<Doc<'requests'>, 'requesterEmail' | 'subjectEmail'>
) {
  return request.requesterEmail ?? request.subjectEmail
}

function getMemberRolePriority(role: Doc<'workspaceMembers'>['role']) {
  if (role === 'owner') {
    return 0
  }

  if (role === 'admin') {
    return 1
  }

  return 2
}

function formatRequestTypeLabel(requestType: Doc<'requests'>['requestType']) {
  return requestType.charAt(0).toUpperCase() + requestType.slice(1)
}

function formatTemplateKeyLabel(value: string | null) {
  if (value === null) {
    return 'Email'
  }

  if (value === 'denial_update') {
    return 'Denial / Update'
  }

  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatRequestStatusLabel(status: RequestStatus) {
  return status
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatVerificationStatusLabel(status: Doc<'requests'>['verificationStatus']) {
  return status
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function createExportNotesSummary(notes: Array<Pick<Doc<'requestNotes'>, 'body' | 'isInternal'>>) {
  if (notes.length === 0) {
    return null
  }

  return truncateSummaryText(
    notes
      .map((note) => `${note.isInternal ? 'Internal' : 'Shared'}: ${collapseWhitespace(note.body)}`)
      .join(' | '),
    240
  )
}

function createExportEmailSummary(
  emailLogs: Array<
    Pick<
      Doc<'emailLogs'>,
      'templateKey' | 'toEmail' | 'status' | 'deliveryMode' | 'subject' | 'sentAt' | '_creationTime'
    >
  >
) {
  if (emailLogs.length === 0) {
    return null
  }

  return truncateSummaryText(
    emailLogs
      .map((emailLog) => {
        const timestamp = emailLog.sentAt ?? emailLog._creationTime
        const templateLabel = formatTemplateKeyLabel(emailLog.templateKey)
        const deliveryMode = emailLog.deliveryMode ?? 'unspecified'

        return `${formatExportDate(timestamp)} ${templateLabel} to ${emailLog.toEmail} (${emailLog.status}, ${deliveryMode}) - ${collapseWhitespace(emailLog.subject)}`
      })
      .join(' | '),
    320
  )
}

function createExportTimelineSummary(
  events: Array<Pick<Doc<'requestEvents'>, 'eventType' | 'message' | '_creationTime'>>
) {
  if (events.length === 0) {
    return null
  }

  return truncateSummaryText(
    events
      .slice(0, 4)
      .map((event) => {
        const label = collapseWhitespace(event.message ?? titleize(event.eventType))
        return `${formatExportDate(event._creationTime)} ${label}`
      })
      .join(' | '),
    280
  )
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function truncateSummaryText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

function formatExportDate(value: number) {
  return new Date(value).toISOString().slice(0, 10)
}

function titleize(value: string) {
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function assertValidEmailAddress(value: string, label: 'subject' | 'requester') {
  if (!isValidEmailAddress(value)) {
    throw new Error(`Enter a valid ${label} email address.`)
  }
}

function normalizeOptionalEmailAddress(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return null
  }

  const normalizedEmail = normalizeEmail(value)
  assertValidEmailAddress(normalizedEmail, 'requester')
  return normalizedEmail
}

export function formatCaseId(requestId: Id<'requests'>) {
  return `REQ-${requestId.slice(-6).toUpperCase()}`
}

