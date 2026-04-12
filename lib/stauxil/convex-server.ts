import { ConvexHttpClient } from 'convex/browser'

export function getServerConvexClient() {
  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL

  if (!deploymentUrl) {
    throw new Error('Missing NEXT_PUBLIC_CONVEX_URL in your environment.')
  }

  return new ConvexHttpClient(deploymentUrl)
}
