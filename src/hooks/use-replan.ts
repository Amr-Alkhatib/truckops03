import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recalcDates } from "@/lib/booking.functions";

/** Re-runs the truck planner for affected future dates after an admin change. */
export function useReplan() {
  const fn = useServerFn(recalcDates);
  const qc = useQueryClient();
  return async (reason: string, dates?: string[]) => {
    try {
      const r = await fn({ data: { reason, dates } });
      if (r.changed || r.conflicts)
        toast.info(`Planner re-ran ${r.dates} date(s): ${r.changed} booking(s) re-assigned, ${r.conflicts} in conflict`);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(`Re-planning failed: ${e?.message ?? e}`);
    }
  };
}
