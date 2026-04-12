# Stauxil

Stauxil is a Next.js + Clerk + Convex MVP for managing privacy requests, tracking verification and deadlines, and keeping an operational audit trail.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with the local values for:

```bash
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER_DOMAIN=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SITE_URL=
EMAIL_PROVIDER=
EMAIL_FROM=
EMAIL_REPLY_TO=
RESEND_API_KEY=
```

`NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_SITE_URL` is optional for local UI work, but it should be set when you want generated verification links to point at the correct app URL.

For outbound verification delivery, set `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `RESEND_API_KEY`. `EMAIL_REPLY_TO` is optional. If the provider config is missing, Stauxil still creates the request and verification token, but the request audit trail records the verification email as a failed provider send.

3. Start Convex in one terminal:

```bash
npx convex dev
```

4. Start the Next.js app in another terminal:

```bash
npm run dev
```

The authenticated app shell lives at `/`, and the public request flow is served from `/request/[workspaceSlug]`.

## Validation

Run the required launch-readiness checks before shipping changes:

```bash
npm run lint
npm run typecheck
npm run build
```

## Verification email testing

1. Set `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, `RESEND_API_KEY`, and optionally `EMAIL_REPLY_TO`.
2. Start `npx convex dev` and `npm run dev`.
3. Submit a public request from `/request/[workspaceSlug]`.
4. Open the request in the app and confirm the email log moves from `Queued` to `Sent` with delivery mode `Provider`, and the activity timeline records the verification send. If you leave the provider vars unset, the request still lands, but the email log changes to `Failed` and the timeline records the failure reason.
5. Open the link from the received email and confirm the request moves to `Verified`.

## Notes for contributors

- Read [AGENTS.md](./AGENTS.md) before making repo changes.
- Read [convex/_generated/ai/guidelines.md](./convex/_generated/ai/guidelines.md) before editing Convex code.
- Keep backend access workspace-scoped, typed, and simple.
