import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type AccessCtx = QueryCtx | MutationCtx

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function getDefaultWorkspaceName(input: {
  name?: string | null
  email?: string | null
}): string {
  const trimmedName = input.name?.trim()
  if (trimmedName) {
    return `${trimmedName}'s workspace`
  }

  const trimmedEmail = input.email?.trim()
  if (trimmedEmail) {
    const localPart = trimmedEmail.split('@')[0]?.trim()
    if (localPart) {
      return `${localPart}'s workspace`
    }
  }

  return 'My workspace'
}

export async function requireIdentity(ctx: AccessCtx) {
  const identity = await ctx.auth.getUserIdentity()

  if (identity === null) {
    throw new Error('Not authenticated')
  }

  return identity
}

export async function requireWorkspaceAccess(
  ctx: AccessCtx,
  workspaceId: Id<'workspaces'>
): Promise<{
  identity: Awaited<ReturnType<AccessCtx['auth']['getUserIdentity']>>
  membership: Doc<'workspaceMembers'>
  workspace: Doc<'workspaces'>
}> {
  const identity = await requireIdentity(ctx)
  const membership = await ctx.db
    .query('workspaceMembers')
    .withIndex('by_workspace_id_and_token_identifier', (q) =>
      q.eq('workspaceId', workspaceId).eq('tokenIdentifier', identity.tokenIdentifier)
    )
    .unique()

  if (membership === null) {
    throw new Error('Workspace not found')
  }

  const workspace = await ctx.db.get(workspaceId)
  if (workspace === null || workspace.archivedAt !== null) {
    throw new Error('Workspace not found')
  }

  return { identity, membership, workspace }
}

export async function requireRequestAccess(
  ctx: AccessCtx,
  workspaceId: Id<'workspaces'>,
  requestId: Id<'requests'>
) {
  const access = await requireWorkspaceAccess(ctx, workspaceId)
  const request = await ctx.db.get(requestId)

  if (request === null || request.workspaceId !== workspaceId || request.archivedAt !== null) {
    throw new Error('Request not found')
  }

  return {
    ...access,
    request,
  }
}
