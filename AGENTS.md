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

## Architecture rules
- All pricing/assignment logic lives in the pure `src/lib/engine` module; it takes DB-loaded config (`src/lib/data.ts`) and never hard-codes prices — keeps quotes testable and admin-editable.
- Bookings are only inserted by the `submitBooking` server function, which recomputes OSRM distance and the quote server-side — planners can't tamper with prices (no INSERT grant for them).
- Cross-planner data the engine needs (truck occupancy, compliance, approval-by-token) is exposed via SECURITY DEFINER RPCs that return no personal data.
- tsconfig keeps `strict` but disables exactOptionalPropertyTypes/noUncheckedIndexedAccess/noPropertyAccessFromIndexSignature — they fought generated Supabase types and Zod output.
