import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx } from './_generated/server'
import { requireRequestAccess } from './lib/access'

type InsertRequestEventArgs = {
  workspaceId: Id<'workspaces'>
  requestId: Id<'requests'>
  actorType: string
  actorMemberId: Id<'workspaceMembers'> | null
  eventType: string
  message: string | null
  details?: Record<string, string>
}

export async function insertRequestEvent(
  ctx: MutationCtx,
  args: InsertRequestEventArgs
): Promise<Id<'requestEvents'>> {
  const now = Date.now()
  const eventId = await ctx.db.insert('requestEvents', {
    workspaceId: args.workspaceId,
    requestId: args.requestId,
    actorType: args.actorType,
    actorMemberId: args.actorMemberId,
    eventType: args.eventType,
    message: args.message,
    details: args.details,
  })

  await ctx.db.patch(args.requestId, { lastEventAt: now })
  return eventId
}

export const listByRequest = query({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRequestAccess(ctx, args.workspaceId, args.requestId)

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100)
    return await ctx.db
      .query('requestEvents')
      .withIndex('by_workspace_id_and_request_id', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('requestId', args.requestId)
      )
      .order('desc')
      .take(limit)
  },
})

export const create = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    requestId: v.id('requests'),
    eventType: v.string(),
    message: v.optional(v.string()),
    details: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const { membership } = await requireRequestAccess(ctx, args.workspaceId, args.requestId)

    return await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      actorType: 'member',
      actorMemberId: membership._id,
      eventType: args.eventType,
      message: args.message ?? null,
      details: args.details,
    })
  },
})
