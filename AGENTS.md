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
- Truck assignment is a day-level solver (`src/lib/engine/solver.ts`) run identically in the browser (preview) and server; only `commit_day_plan` (advisory lock + snapshot check) may write trucks/totals — a trigger blocks every other write to computed booking fields.
- System rules (`pair_rules.is_system`) are immutable via DB trigger; legal/fee seed data carries source_url/verified_on/status and unknowns stay NULL so the engine routes them to "Permit check" instead of guessing.
- The booking wizard lives in `src/components/BookingWizard.tsx` and serves both `/book` (account) and `/p/$token` (planner link, booking owned by the link creator); the review step always shows the server quote (`previewQuote*`), the browser engine only drives live feedback.
- Every admin table has a `log_admin_change` trigger writing `admin_change_log`; add the trigger to any new admin-editable table.
- UI text is translated via `src/lib/i18n.ts` keyed by English text; untranslated strings fall back to English.
