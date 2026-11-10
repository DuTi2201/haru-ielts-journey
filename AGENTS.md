<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Haru architecture

- Use TanStack file routes for all screens because this project runs on TanStack Start.
- Use Hanji Pop semantic tokens from `src/styles.css`; do not introduce ad-hoc colors in feature components.
- Client-only app: all data/auth goes through `src/lib/api/*` to the external FastAPI backend (`VITE_API_BASE_URL`); never use the Supabase SDK or Supabase Auth, per owner decision.
- Job progress uses `useJobEvents` (SSE with `?token=`, 2s polling fallback) because EventSource cannot send Bearer headers.
