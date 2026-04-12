<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

# Stauxil MVP instructions
Build the MVP described in the design document.
Priorities:
1. Deliver working end-to-end request flow before polish.
2. Keep implementation simple and typed.
3. Enforce workspace isolation in every backend query and mutation.
4. Do not add external integrations unless required for core email verification.
5. Prefer small reusable components over large pages.
6. Use existing scripts for lint, typecheck, and build validation.
Required checks after changes:
- npm run lint
- npm run typecheck
- npm run build
Do not claim legal compliance in product copy. Use operational wording like:
- Manage privacy requests
- Track deadlines and verification
- Maintain an audit trail