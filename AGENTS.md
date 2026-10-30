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
- All data access goes through `src/services/api.ts` (currently browser storage + sample data); swap it for Supabase/n8n without touching pages.
- App state lives in `src/store/app-store.tsx` context; pages read/write only through `useAppStore`.
- Shared domain types live in `src/types`; sample data in `src/data/sample.ts` is flagged with `isSample`.
