import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireRequestAccess } from './lib/access'
import { insertRequestEvent } from './requestEvents'

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
      .query('requestNotes')
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
    body: v.string(),
    isInternal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { membership } = await requireRequestAccess(ctx, args.workspaceId, args.requestId)
    const body = args.body.trim()

    if (!body) {
      throw new Error('Note body is required')
    }

    const noteId = await ctx.db.insert('requestNotes', {
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      authorMemberId: membership._id,
      body,
      isInternal: args.isInternal ?? true,
    })

    await insertRequestEvent(ctx, {
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      actorType: 'member',
      actorMemberId: membership._id,
      eventType: 'note_added',
      message: args.isInternal ?? true ? 'Added an internal note' : 'Added a request note',
      details: {
        visibility: args.isInternal ?? true ? 'internal' : 'shared',
      },
    })

    return noteId
  },
})
