# Haru scaffold and Today screen

## Scope
- Establish the Hanji Pop design tokens, Korean/Vietnamese fonts, shared learner shell, five-tab navigation, and geometric Kkachi mascot.
- Build `/today` completely for a 390 px mobile-first layout, including the specified header, gate card, daily tasks, tip, and fixed tab bar.
- Add placeholder pages only for the remaining requested learner and studio paths; `/` will redirect to `/today`.
- Add TypeScript domain models and explicit workflow/state types for jobs, writing, and imports.
- Add a PWA manifest and basic install metadata without adding unnecessary packages.
- Create and apply the database schema, indexes, row-level access rules, Realtime jobs publication, and three private storage buckets.

## Platform-aligned architecture
- Lovable Cloud provides PostgreSQL, Auth, Storage, Realtime, scheduling, and server-side functions.
- Gemini work will be queued through `jobs` and performed asynchronously by server functions; no client request will call Gemini directly.
- Roles will use the required separate `user_roles` table, not `profiles.role`, to prevent privilege escalation.
- The project uses TanStack file routes rather than React Router route declarations, preserving the requested URLs exactly.
- No AI worker, cron routine, auth UI, or full secondary screen is implemented in this first scaffold.

## Validation
- Confirm the database migration and generated database types.
- Check the preview build and inspect `/today` at 390 px and desktop widths.
- Verify links, fixed tab bar, visible layout, and no runtime console errors.
