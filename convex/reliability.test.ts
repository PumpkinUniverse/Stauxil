/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

function createTestConvex() {
  return convexTest(schema, modules)
}

function buildWorkspaceInsert(input: {
  name: string
  slug: string
  tokenIdentifier: string
  supportEmail?: string | null
}) {
  return {
    name: input.name,
    slug: input.slug,
    publicBrandName: input.name,
    publicIntakeIntro: `Intro for ${input.name}`,
    publicIntakeSuccessMessage: 'Success',
    allowedPublicRequestTypes: ['access' as const],
    supportEmail: input.supportEmail ?? 'support@example.com',
    timezone: 'UTC',
    defaultSlaDays: 30,
    brandColor: '#537dc4',
    logoUrl: null,
    plan: 'starter' as const,
    publicRequestInitialStatus: 'received' as const,
    createdByTokenIdentifier: input.tokenIdentifier,
    createdByEmail: 'owner@example.com',
    isPersonal: false,
    archivedAt: null,
  }
}

function buildRequestInsert(input: {
  workspaceId: Id<'workspaces'>
  caseId: string
  assignedMemberId?: Id<'workspaceMembers'> | null
  verificationStatus?: 'pending' | 'verified' | 'failed' | 'expired' | 'not_required'
}) {
  return {
    workspaceId: input.workspaceId,
    caseId: input.caseId,
    requestType: 'access' as const,
    status: 'received' as const,
    verificationStatus: input.verificationStatus ?? ('pending' as const),
    title: `Request ${input.caseId}`,
    description: 'Test request',
    jurisdiction: null,
    accountReference: null,
    subjectEmail: 'subject@example.com',
    subjectName: 'Subject Person',
    requesterEmail: 'requester@example.com',
    requesterName: 'Requester Person',
    dueAt: null,
    submittedAt: Date.now(),
    verifiedAt: input.verificationStatus === 'verified' ? Date.now() : null,
    lastEventAt: Date.now(),
    createdByMemberId: null,
    assignedMemberId: input.assignedMemberId ?? null,
    completedAt: null,
    archivedAt: null,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('verification reliability', () => {
  it('expires every prior pending token for the request, even beyond 20 tokens', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T12:00:00Z'))

    const t = createTestConvex()
    const user = t.withIdentity({
      tokenIdentifier: 'owner-token',
      email: 'owner@example.com',
      name: 'Owner',
    })
    const { workspaceId } = await user.mutation(api.workspaces.create, { name: 'Token Workspace' })
    const requestId = await user.mutation(api.requests.create, {
      workspaceId,
      requestType: 'access',
      title: 'Access request',
      description: 'Need an access export for test coverage.',
      subjectEmail: 'subject@example.com',
      requesterEmail: 'requester@example.com',
      verificationStatus: 'pending',
    })

    for (let index = 0; index < 25; index += 1) {
      await user.mutation(api.verification.createToken, {
        workspaceId,
        requestId,
      })
    }

    const tokens = await user.query(api.verification.listByRequest, {
      workspaceId,
      requestId,
      limit: 50,
    })

    expect(tokens.filter((token) => token.status === 'pending')).toHaveLength(1)
    expect(tokens.filter((token) => token.status === 'expired')).toHaveLength(24)
  })

  it('skips queued verification delivery after the request is manually verified', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T12:00:00Z'))

    const t = createTestConvex()
    const user = t.withIdentity({
      tokenIdentifier: 'owner-token',
      email: 'owner@example.com',
      name: 'Owner',
    })
    const { workspaceId } = await user.mutation(api.workspaces.create, { name: 'Verified Workspace' })
    const requestId = await user.mutation(api.requests.create, {
      workspaceId,
      requestType: 'access',
      title: 'Access request',
      description: 'Need an access export for scheduled verification coverage.',
      subjectEmail: 'subject@example.com',
      requesterEmail: 'requester@example.com',
      verificationStatus: 'pending',
    })

    await user.mutation(api.verification.createToken, {
      workspaceId,
      requestId,
    })
    await user.mutation(api.verification.markVerifiedManually, {
      workspaceId,
      requestId,
    })

    await t.finishAllScheduledFunctions(() => {
      vi.runAllTimers()
    })

    const request = await user.query(api.requests.get, {
      workspaceId,
      requestId,
    })
    const emailLogs = await user.query(api.emailLogs.listByWorkspace, {
      workspaceId,
      requestId,
      limit: 10,
    })

    expect(request.verificationStatus).toBe('verified')
    expect(emailLogs).toHaveLength(1)
    expect(emailLogs[0]?.status).toBe('failed')
    expect(emailLogs[0]?.errorMessage).toContain('already verified')
  })

  it('does not regress a verified request when stale delivery finalization runs', async () => {
    const t = createTestConvex()

    let workspaceId!: Id<'workspaces'>
    let requestId!: Id<'requests'>
    let tokenId!: Id<'verificationTokens'>
    let emailLogId!: Id<'emailLogs'>

    await t.run(async (ctx) => {
      workspaceId = await ctx.db.insert(
        'workspaces',
        buildWorkspaceInsert({
          name: 'Finalize Workspace',
          slug: 'finalize-workspace',
          tokenIdentifier: 'owner-token',
        })
      )

      await ctx.db.insert('workspaceMembers', {
        workspaceId,
        tokenIdentifier: 'owner-token',
        email: 'owner@example.com',
        name: 'Owner',
        role: 'owner',
      })

      requestId = await ctx.db.insert(
        'requests',
        buildRequestInsert({
          workspaceId,
          caseId: 'REQ-FINAL',
          verificationStatus: 'verified',
        })
      )

      tokenId = await ctx.db.insert('verificationTokens', {
        workspaceId,
        requestId,
        email: 'requester@example.com',
        tokenHash: 'hash',
        status: 'pending',
        expiresAt: Date.now() + 60_000,
        consumedAt: null,
        lastSentAt: null,
        attemptCount: 0,
        createdByMemberId: null,
      })

      emailLogId = await ctx.db.insert('emailLogs', {
        workspaceId,
        requestId,
        templateId: null,
        templateKey: 'verification',
        toEmail: 'requester@example.com',
        subject: 'Verify request',
        body: 'Verify request body',
        status: 'queued',
        deliveryMode: 'provider',
        fromEmail: 'service@example.com',
        replyToEmail: 'support@example.com',
        senderSource: 'platform',
        providerName: 'resend',
        errorMessage: null,
        sentAt: null,
        createdByMemberId: null,
      })
    })

    await t.mutation(internal.verificationDelivery.finalizeVerificationEmailDelivery, {
      workspaceId,
      requestId,
      tokenId,
      emailLogId,
      outcome: 'failed',
      errorMessage: 'Delayed provider failure',
    })

    const request = await t.run(async (ctx) => await ctx.db.get(requestId))
    expect(request?.verificationStatus).toBe('verified')
  })
})

describe('workspace and member lookup caps', () => {
  it('returns all accessible workspaces beyond the previous 25-workspace cap', async () => {
    const t = createTestConvex()

    await t.run(async (ctx) => {
      for (let index = 0; index < 30; index += 1) {
        const workspaceId = await ctx.db.insert(
          'workspaces',
          buildWorkspaceInsert({
            name: `Workspace ${index}`,
            slug: `workspace-${index}`,
            tokenIdentifier: 'owner-token',
          })
        )

        await ctx.db.insert('workspaceMembers', {
          workspaceId,
          tokenIdentifier: 'owner-token',
          email: 'owner@example.com',
          name: 'Owner',
          role: 'owner',
        })
      }
    })

    const workspaces = await t
      .withIdentity({
        tokenIdentifier: 'owner-token',
        email: 'owner@example.com',
      })
      .query(api.workspaces.listForCurrentUser)

    expect(workspaces).toHaveLength(30)
  })

  it('returns all members for request detail and inbox metadata beyond the previous 100-member cap', async () => {
    const t = createTestConvex()

    let workspaceId!: Id<'workspaces'>
    let assignedMemberId!: Id<'workspaceMembers'>

    await t.run(async (ctx) => {
      workspaceId = await ctx.db.insert(
        'workspaces',
        buildWorkspaceInsert({
          name: 'Large Workspace',
          slug: 'large-workspace',
          tokenIdentifier: 'owner-token',
        })
      )

      for (let index = 0; index < 105; index += 1) {
        const memberId = await ctx.db.insert('workspaceMembers', {
          workspaceId,
          tokenIdentifier: index === 0 ? 'owner-token' : `member-token-${index}`,
          email: `member-${index}@example.com`,
          name: `Member ${index}`,
          role: index === 0 ? 'owner' : 'member',
        })

        if (index === 104) {
          assignedMemberId = memberId
        }
      }

      await ctx.db.insert(
        'requests',
        buildRequestInsert({
          workspaceId,
          caseId: 'REQ-LARGE',
          assignedMemberId,
        })
      )
    })

    const user = t.withIdentity({
      tokenIdentifier: 'owner-token',
      email: 'owner@example.com',
    })
    const detail = await user.query(api.requests.getDetailByCaseId, {
      workspaceId,
      caseId: 'REQ-LARGE',
    })
    const metadata = await user.query(api.requests.getInboxMetadata, {
      workspaceId,
    })

    expect(detail?.members).toHaveLength(105)
    expect(detail?.request.owner?.id).toBe(assignedMemberId)
    expect(metadata.owners).toHaveLength(105)
  })
})

describe('request email validation', () => {
  it('rejects malformed subject emails during request creation', async () => {
    const t = createTestConvex()
    const user = t.withIdentity({
      tokenIdentifier: 'owner-token',
      email: 'owner@example.com',
      name: 'Owner',
    })
    const { workspaceId } = await user.mutation(api.workspaces.create, { name: 'Validation Workspace' })

    await expect(
      user.mutation(api.requests.create, {
        workspaceId,
        requestType: 'access',
        title: 'Broken request',
        description: 'This request should fail because the subject email is invalid.',
        subjectEmail: 'not-an-email',
      })
    ).rejects.toThrow('Enter a valid subject email address.')
  })

  it('rejects malformed requester emails during request updates', async () => {
    const t = createTestConvex()
    const user = t.withIdentity({
      tokenIdentifier: 'owner-token',
      email: 'owner@example.com',
      name: 'Owner',
    })
    const { workspaceId } = await user.mutation(api.workspaces.create, { name: 'Update Workspace' })
    const requestId = await user.mutation(api.requests.create, {
      workspaceId,
      requestType: 'access',
      title: 'Valid request',
      description: 'This request will later receive an invalid requester email update.',
      subjectEmail: 'subject@example.com',
      requesterEmail: 'requester@example.com',
    })

    await expect(
      user.mutation(api.requests.updateDetails, {
        workspaceId,
        requestId,
        requesterEmail: 'invalid-requester',
      })
    ).rejects.toThrow('Enter a valid requester email address.')
  })
})
