import { createFileRoute } from "@tanstack/react-router";
import { WeekGrid } from "@/components/admin/WeekGrid";

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  component: () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Calendar</h1>
      <WeekGrid days={28} />
    </div>
  ),
});
