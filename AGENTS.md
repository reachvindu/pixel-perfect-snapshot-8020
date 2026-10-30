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

## Architecture
- All backend calls go through `src/services/api.ts`; pages use the react-query hooks in `src/store/app-store.tsx` (`useMe`, `useWorkspace`, `useAction`), never the database client directly.
- Access control lives in the database: roles in `user_roles` (admin/editor/viewer), approval in `profiles.status`, RLS via `is_approved`/`can_edit`; admin changes go through security-definer RPCs. UI role checks are cosmetic only.
- Signed-in pages live under `src/routes/_authenticated/_shell/` (the `_shell` layout renders the sidebar and the pending-approval screen).
- Live transcription: browser records WAV segments (`src/lib/live-recorder.ts`) and posts them to the `/api/transcribe` server route, which verifies the bearer token and editor rights.
- Shared domain types live in `src/types`; demo rows are flagged `is_sample` in the database.
- Board assistant: `/api/assistant` only plans actions (strict JSON from the AI gateway); the browser executes them via `runAssistantActions` in `src/services/api.ts`, so RLS still governs every change.
