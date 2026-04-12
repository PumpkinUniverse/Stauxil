import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { requireWorkspaceAccess } from './lib/access'
import {
  getRequestEmailTemplateAliases,
  getRequestEmailTemplateDefinition,
  REQUEST_EMAIL_TEMPLATE_KEYS,
  type RequestEmailTemplateKey,
} from './lib/requestEmailTemplates'
import { emailTemplateKeyValidator } from './validators'

type TemplateLookupCtx = MutationCtx | QueryCtx

type EffectiveEmailTemplate = {
  _id: Id<'emailTemplates'> | null
  key: RequestEmailTemplateKey
  storedKey: string | null
  name: string
  description: string | null
  subject: string
  body: string
  isSystem: boolean
  isEnabled: boolean
  isCustomized: boolean
}

async function findStoredEmailTemplate(
  ctx: TemplateLookupCtx,
  workspaceId: Id<'workspaces'>,
  key: RequestEmailTemplateKey
) {
  const candidateKeys = [key, ...getRequestEmailTemplateAliases(key)]

  for (const candidateKey of candidateKeys) {
    const template = await ctx.db
      .query('emailTemplates')
      .withIndex('by_workspace_id_and_key', (q) =>
        q.eq('workspaceId', workspaceId).eq('key', candidateKey)
      )
      .unique()

    if (template !== null) {
      return template
    }
  }

  return null
}

export async function getEffectiveEmailTemplate(
  ctx: TemplateLookupCtx,
  workspaceId: Id<'workspaces'>,
  key: RequestEmailTemplateKey
): Promise<EffectiveEmailTemplate> {
  const definition = getRequestEmailTemplateDefinition(key)
  const stored = await findStoredEmailTemplate(ctx, workspaceId, key)

  return {
    _id: stored?._id ?? null,
    key,
    storedKey: stored?.key ?? null,
    name: stored?.name ?? definition.name,
    description: stored === null ? definition.description : stored.description,
    subject: stored?.subject ?? definition.subject,
    body: stored?.body ?? definition.body,
    isSystem: stored?.isSystem ?? true,
    isEnabled: stored?.isEnabled ?? true,
    isCustomized: stored !== null,
  }
}

export async function ensureDefaultEmailTemplates(
  ctx: MutationCtx,
  workspaceId: Id<'workspaces'>
): Promise<void> {
  for (const key of REQUEST_EMAIL_TEMPLATE_KEYS) {
    const existing = await findStoredEmailTemplate(ctx, workspaceId, key)

    if (existing !== null) {
      continue
    }

    const definition = getRequestEmailTemplateDefinition(key)
    await ctx.db.insert('emailTemplates', {
      workspaceId,
      key,
      name: definition.name,
      description: definition.description,
      subject: definition.subject,
      body: definition.body,
      isSystem: true,
      isEnabled: true,
    })
  }
}

export const listByWorkspace = query({
  args: {
    workspaceId: v.id('workspaces'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100)
    return await ctx.db
      .query('emailTemplates')
      .withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
      .take(limit)
  },
})

export const listEffectiveByWorkspace = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)

    return await Promise.all(
      REQUEST_EMAIL_TEMPLATE_KEYS.map(async (key) => await getEffectiveEmailTemplate(ctx, args.workspaceId, key))
    )
  },
})

export const getByKey = query({
  args: {
    workspaceId: v.id('workspaces'),
    key: emailTemplateKeyValidator,
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)
    return await getEffectiveEmailTemplate(ctx, args.workspaceId, args.key)
  },
})

export const upsert = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    key: emailTemplateKeyValidator,
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    subject: v.string(),
    body: v.string(),
    isEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId)

    const key = args.key
    const definition = getRequestEmailTemplateDefinition(key)
    const name = args.name.trim()
    const subject = args.subject.trim()
    const body = args.body.trim()

    if (!name || !subject || !body) {
      throw new Error('Email template name, subject, and body are required')
    }

    const existing = await findStoredEmailTemplate(ctx, args.workspaceId, key)

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        key,
        name,
        description: args.description ?? null,
        subject,
        body,
        isEnabled: args.isEnabled ?? existing.isEnabled,
      })

      return existing._id
    }

    return await ctx.db.insert('emailTemplates', {
      workspaceId: args.workspaceId,
      key,
      name,
      description: args.description ?? definition.description,
      subject,
      body,
      isSystem: true,
      isEnabled: args.isEnabled ?? true,
    })
  },
})
