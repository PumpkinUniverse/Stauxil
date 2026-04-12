import { auth } from '@clerk/nextjs/server'

export async function getConvexServerAuth() {
  const clerkAuth = await auth()
  const token =
    clerkAuth.sessionClaims?.aud === 'convex'
      ? await clerkAuth.getToken()
      : await clerkAuth.getToken({ template: 'convex' })

  return {
    clerkAuth,
    token,
  }
}
